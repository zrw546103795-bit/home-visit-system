import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  DRIZZLE_DATABASE,
  type PostgresJsDatabase,
} from '../../platform-shim';
import { eq, and, desc, count, sql } from 'drizzle-orm';
import {
  accessRequest,
  headTeacher,
  homeroomClass,
} from '@server/database/schema';
import type {
  AccessRequest,
  AccessRequestStatus,
  CreateAccessRequestDto,
  CurrentUser,
  PaginatedResponse,
  ReviewAccessRequestDto,
  UserRole,
  Grade,
} from '@shared/api.interface';

function extractPostgresErrorCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current && typeof current === 'object'; depth += 1) {
    const { code, cause } = current as { code?: unknown; cause?: unknown };
    if (typeof code === 'string') return code;
    current = cause;
  }
  return undefined;
}

@Injectable()
export class AccessRequestService {
  private readonly logger = new Logger(AccessRequestService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  private mapAccessRequest(row: {
    id: string;
    platformUserId: string;
    platformUserName: string;
    name: string;
    role: string;
    grade: string | null;
    className: string | null;
    reason: string | null;
    status: string;
    reviewerUserId: string | null;
    reviewedAt: Date | null;
    rejectReason: string | null;
    createdAt: Date;
  }): AccessRequest {
    return {
      id: row.id,
      platformUserId: row.platformUserId,
      platformUserName: row.platformUserName,
      name: row.name,
      role: row.role as UserRole,
      grade: row.grade as Grade | undefined,
      className: row.className ?? undefined,
      reason: row.reason ?? undefined,
      status: row.status as AccessRequestStatus,
      reviewerId: row.reviewerUserId ?? undefined,
      reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : undefined,
      rejectReason: row.rejectReason ?? undefined,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private validateCreateDto(dto: CreateAccessRequestDto): void {
    if (!dto.name) {
      throw new BadRequestException('姓名不能为空');
    }
    if (!dto.role) {
      throw new BadRequestException('身份不能为空');
    }
    const validRoles: UserRole[] = ['teacher', 'grade_head', 'grade_director', 'school_leader'];
    if (!validRoles.includes(dto.role)) {
      throw new BadRequestException('无效的身份选择');
    }
    if (
      (dto.role === 'teacher' || dto.role === 'grade_head' || dto.role === 'grade_director') &&
      !dto.grade
    ) {
      throw new BadRequestException('请选择年级');
    }
    if (dto.role === 'teacher' && !dto.className) {
      throw new BadRequestException('请填写班级');
    }
  }

  async createRequest(
    dto: CreateAccessRequestDto,
    platformUserId: string,
    platformUserName: string,
  ): Promise<{ request: AccessRequest }> {
    this.validateCreateDto(dto);

    const existing = await this.db
      .select({ id: accessRequest.id, status: accessRequest.status })
      .from(accessRequest)
      .where(eq(accessRequest.platformUserId, platformUserId));

    if (existing.length > 0 && existing[0].status === 'pending') {
      throw new ConflictException('您已有待审核的申请，请等待审核');
    }

    try {
      const inserted = await this.db
        .insert(accessRequest)
        .values({
          platformUserId,
          platformUserName,
          name: dto.name,
          role: dto.role,
          grade: dto.grade,
          className: dto.className,
          reason: dto.reason,
          status: 'pending',
        })
        .returning({
          id: accessRequest.id,
          platformUserId: accessRequest.platformUserId,
          platformUserName: accessRequest.platformUserName,
          name: accessRequest.name,
          role: accessRequest.role,
          grade: accessRequest.grade,
          className: accessRequest.className,
          reason: accessRequest.reason,
          status: accessRequest.status,
          reviewerUserId: sql<string>`(${accessRequest.reviewerId}).user_id`.as('reviewer_user_id'),
          reviewedAt: accessRequest.reviewedAt,
          rejectReason: accessRequest.rejectReason,
          createdAt: accessRequest.createdAt,
        });

      const request: AccessRequest = this.mapAccessRequest(inserted[0]);
      this.logger.log(`提交访问申请：${dto.name} (${platformUserId})，角色：${dto.role}`);
      return { request };
    } catch (error) {
      const code = extractPostgresErrorCode(error);
      if (code === '23505') {
        throw new ConflictException('您已有待审核的申请，请等待审核');
      }
      this.logger.error(
        `提交申请异常：${platformUserId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  async getMyRequest(platformUserId: string): Promise<{ request: AccessRequest | null }> {
    const rows = await this.db
      .select({
        id: accessRequest.id,
        platformUserId: accessRequest.platformUserId,
        platformUserName: accessRequest.platformUserName,
        name: accessRequest.name,
        role: accessRequest.role,
        grade: accessRequest.grade,
        className: accessRequest.className,
        reason: accessRequest.reason,
        status: accessRequest.status,
        reviewerUserId: sql<string>`(${accessRequest.reviewerId}).user_id`.as('reviewer_user_id'),
        reviewedAt: accessRequest.reviewedAt,
        rejectReason: accessRequest.rejectReason,
        createdAt: accessRequest.createdAt,
      })
      .from(accessRequest)
      .where(eq(accessRequest.platformUserId, platformUserId))
      .orderBy(desc(accessRequest.createdAt))
      .limit(1);

    if (rows.length === 0) {
      return { request: null };
    }

    return { request: this.mapAccessRequest(rows[0]) };
  }

  private async isAdmin(
    userId: string,
    roles: string[] | undefined,
  ): Promise<boolean> {
    const roleList = Array.isArray(roles) ? roles : [];
    if (roleList.includes('admin')) {
      return true;
    }

    const teachers = await this.db
      .select({ role: headTeacher.role })
      .from(headTeacher)
      .where(sql`(${headTeacher.userId}).user_id = ${userId}`);

    return teachers.some((t: { role: string }) => t.role === 'admin');
  }

  private async checkAdmin(
    userId: string,
    roles: string[] | undefined,
  ): Promise<void> {
    const isAdminUser = await this.isAdmin(userId, roles);
    if (!isAdminUser) {
      throw new ForbiddenException('无权限访问');
    }
  }

  async getRequestList(
    userId: string,
    roles: string[] | undefined,
    page: number,
    pageSize: number,
    status?: AccessRequestStatus,
  ): Promise<PaginatedResponse<AccessRequest>> {
    await this.checkAdmin(userId, roles);

    const conditions = [];
    if (status) {
      conditions.push(eq(accessRequest.status, status));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const countResult = await this.db
      .select({ count: count() })
      .from(accessRequest)
      .where(whereClause);
    const total: number = Number(countResult[0]?.count ?? 0);

    const offset = (page - 1) * pageSize;
    const rows = await this.db
      .select({
        id: accessRequest.id,
        platformUserId: accessRequest.platformUserId,
        platformUserName: accessRequest.platformUserName,
        name: accessRequest.name,
        role: accessRequest.role,
        grade: accessRequest.grade,
        className: accessRequest.className,
        reason: accessRequest.reason,
        status: accessRequest.status,
        reviewerUserId: sql<string>`(${accessRequest.reviewerId}).user_id`.as('reviewer_user_id'),
        reviewedAt: accessRequest.reviewedAt,
        rejectReason: accessRequest.rejectReason,
        createdAt: accessRequest.createdAt,
      })
      .from(accessRequest)
      .where(whereClause)
      .orderBy(desc(accessRequest.createdAt))
      .limit(pageSize)
      .offset(offset);

    const items: AccessRequest[] = rows.map((row) => this.mapAccessRequest(row));

    return { items, total, page, pageSize };
  }

  async getPendingCount(
    userId: string,
    roles: string[] | undefined,
  ): Promise<{ count: number }> {
    await this.checkAdmin(userId, roles);

    const result = await this.db
      .select({ count: count() })
      .from(accessRequest)
      .where(eq(accessRequest.status, 'pending'));

    return { count: Number(result[0]?.count ?? 0) };
  }

  private async findOrCreateClass(grade: string, className: string): Promise<string> {
    const existing = await this.db
      .select({ id: homeroomClass.id })
      .from(homeroomClass)
      .where(
        and(
          eq(homeroomClass.grade, grade),
          eq(homeroomClass.className, className),
        ),
      );

    if (existing.length > 0) {
      return existing[0].id;
    }

    const inserted = await this.db
      .insert(homeroomClass)
      .values({ grade, className })
      .returning({ id: homeroomClass.id });

    return inserted[0].id;
  }

  async reviewRequest(
    userId: string,
    roles: string[] | undefined,
    id: string,
    dto: ReviewAccessRequestDto,
    reviewerUserId: string,
  ): Promise<{ success: boolean; message: string; user?: CurrentUser }> {
    await this.checkAdmin(userId, roles);

    if (dto.action === 'reject' && !dto.rejectReason) {
      throw new BadRequestException('请填写拒绝理由');
    }

    const requests = await this.db
      .select({
        id: accessRequest.id,
        status: accessRequest.status,
        platformUserId: accessRequest.platformUserId,
        name: accessRequest.name,
        role: accessRequest.role,
        grade: accessRequest.grade,
        className: accessRequest.className,
      })
      .from(accessRequest)
      .where(eq(accessRequest.id, id));

    if (requests.length === 0) {
      throw new NotFoundException('申请不存在');
    }

    const requestRow = requests[0];
    if (requestRow.status !== 'pending') {
      throw new BadRequestException('该申请已处理');
    }

    const now = new Date();

    if (dto.action === 'approve') {
      return this.db.transaction(async (tx) => {
        const existingTeachers = await tx
          .select({
            id: headTeacher.id,
            userId: sql<string>`(${headTeacher.userId}).user_id`.as('user_id'),
            name: headTeacher.name,
            grade: headTeacher.grade,
            className: headTeacher.className,
            classId: headTeacher.classId,
            role: headTeacher.role,
          })
          .from(headTeacher)
          .where(sql`(${headTeacher.userId}).user_id = ${requestRow.platformUserId}`);

        let teacherId: string;
        let teacherName: string;
        let teacherRole: UserRole;
        let teacherGrade: Grade | undefined;
        let teacherClassName: string | undefined;
        let teacherClassId: string | undefined;

        if (existingTeachers.length > 0) {
          const existing = existingTeachers[0];
          teacherId = existing.id;
          teacherName = existing.name;
          teacherRole = (existing.role || 'teacher') as UserRole;
          teacherGrade = existing.grade as Grade;
          teacherClassName = existing.className;
          teacherClassId = existing.classId ?? undefined;
          this.logger.log(
            `审批通过：申请 ${id}，用户 ${requestRow.platformUserId} 已存在绑定`,
          );
        } else {
          const grade = requestRow.grade ?? 'grade_1';
          const className = requestRow.className || '1班';
          let classId: string | undefined;

          if (requestRow.role === 'teacher' && grade && className) {
            classId = await this.findOrCreateClass(grade, className);
          }

          const account = `user_${id.replace(/-/g, '').slice(0, 8)}`;
          const password = '12345678';

          const inserted = await tx
            .insert(headTeacher)
            .values({
              userId: requestRow.platformUserId,
              name: requestRow.name,
              account,
              password,
              role: requestRow.role,
              grade,
              className,
              classId,
            })
            .returning({
              id: headTeacher.id,
              name: headTeacher.name,
              grade: headTeacher.grade,
              className: headTeacher.className,
              classId: headTeacher.classId,
              role: headTeacher.role,
            });

          teacherId = inserted[0].id;
          teacherName = inserted[0].name;
          teacherRole = (inserted[0].role || 'teacher') as UserRole;
          teacherGrade = inserted[0].grade as Grade;
          teacherClassName = inserted[0].className;
          teacherClassId = inserted[0].classId ?? undefined;
          this.logger.log(
            `审批通过：为 ${requestRow.name} 创建账号 ${account}`,
          );
        }

        await tx
          .update(accessRequest)
          .set({
            status: 'approved',
            reviewerId: reviewerUserId,
            reviewedAt: now,
          })
          .where(eq(accessRequest.id, id));

        const user: CurrentUser = {
          userId: requestRow.platformUserId,
          name: teacherName,
          role: teacherRole,
          teacherId,
          grade: teacherGrade,
          className: teacherClassName,
          classId: teacherClassId,
        };

        return { success: true, message: '审批通过', user };
      });
    }

    await this.db
      .update(accessRequest)
      .set({
        status: 'rejected',
        reviewerId: reviewerUserId,
        reviewedAt: now,
        rejectReason: dto.rejectReason,
      })
      .where(eq(accessRequest.id, id));

    this.logger.log(`审批拒绝：申请 ${id}，理由：${dto.rejectReason}`);
    return { success: true, message: '已拒绝申请' };
  }
}
