import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  DRIZZLE_DATABASE,
  type PostgresJsDatabase,
} from '../../platform-shim';
import { eq, and, count, desc, ilike } from 'drizzle-orm';
import { student, homeroomClass, headTeacher } from '@server/database/schema';
import type {
  Student,
  StudentListParams,
  CreateStudentDto,
  PaginatedResponse,
} from '@shared/api.interface';

@Injectable()
export class StudentService {
  private readonly logger = new Logger(StudentService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async requireAdmin(teacherId: string): Promise<void> {
    if (!teacherId) {
      throw new UnauthorizedException('未登录');
    }
    const rows = await this.db
      .select({ role: headTeacher.role })
      .from(headTeacher)
      .where(eq(headTeacher.id, teacherId))
      .limit(1);
    if (rows.length === 0) {
      throw new UnauthorizedException('用户不存在或已失效');
    }
    if (rows[0].role !== 'admin') {
      throw new UnauthorizedException('无操作权限');
    }
  }

  async list(params: StudentListParams): Promise<PaginatedResponse<Student>> {
    const { page, pageSize, name, grade, className } = params;
    const offset = (page - 1) * pageSize;

    const conditions = [];
    if (name) conditions.push(ilike(student.name, `%${name}%`));
    if (grade) conditions.push(eq(student.grade, grade));
    if (className) conditions.push(eq(student.className, className));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    try {
      const [totalResult, items] = await Promise.all([
        this.db
          .select({ count: count() })
          .from(student)
          .where(whereClause),
        this.db
          .select()
          .from(student)
          .where(whereClause)
          .orderBy(desc(student.createdAt))
          .limit(pageSize)
          .offset(offset),
      ]);

      const total = Number(totalResult[0]?.count ?? 0);

      return {
        items: items.map((item) => this.mapToStudent(item)),
        total,
        page,
        pageSize,
      };
    } catch (error) {
      this.logger.error(`获取学生列表失败: ${JSON.stringify(params)}`, error as string);
      throw error;
    }
  }

  async getById(id: string): Promise<Student> {
    try {
      const results = await this.db
        .select()
        .from(student)
        .where(eq(student.id, id))
        .limit(1);

      if (results.length === 0) {
        throw new NotFoundException('学生不存在');
      }

      return this.mapToStudent(results[0]);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`获取学生详情失败: id=${id}`, error as string);
      throw error;
    }
  }

  async create(dto: CreateStudentDto): Promise<Student> {
    if (!dto.name?.trim()) {
      throw new BadRequestException('学生姓名不能为空');
    }
    if (!dto.grade) {
      throw new BadRequestException('年级不能为空');
    }
    if (!dto.className?.trim()) {
      throw new BadRequestException('班级不能为空');
    }

    try {
      const classId = await this.ensureClassId(dto.grade, dto.className);

      const inserted = await this.db
        .insert(student)
        .values({
          name: dto.name.trim(),
          grade: dto.grade,
          className: dto.className.trim(),
          classId,
        })
        .returning();

      this.logger.log(`创建学生成功: id=${inserted[0].id}, name=${dto.name}`);
      return this.mapToStudent(inserted[0]);
    } catch (error) {
      this.logger.error(`创建学生失败: ${JSON.stringify(dto)}`, error as string);
      throw error;
    }
  }

  async update(id: string, dto: Partial<CreateStudentDto>): Promise<Student> {
    const patch: Partial<typeof student.$inferInsert> = {};

    if (dto.name !== undefined) {
      if (!dto.name.trim()) {
        throw new BadRequestException('学生姓名不能为空');
      }
      patch.name = dto.name.trim();
    }

    let grade = dto.grade;
    let className = dto.className;

    // If grade or className changes, resolve classId
    if (grade || className) {
      const current = await this.getById(id);
      grade = grade ?? current.grade;
      className = className ?? current.className;
      const trimmedClassName = className.trim();
      if (!trimmedClassName) {
        throw new BadRequestException('班级不能为空');
      }
      patch.grade = grade;
      patch.className = trimmedClassName;
      patch.classId = await this.ensureClassId(grade, trimmedClassName);
    }

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    try {
      const updated = await this.db
        .update(student)
        .set(patch)
        .where(eq(student.id, id))
        .returning();

      if (updated.length === 0) {
        throw new NotFoundException('学生不存在');
      }

      this.logger.log(`更新学生成功: id=${id}`);
      return this.mapToStudent(updated[0]);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`更新学生失败: id=${id}`, error as string);
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    try {
      const deleted = await this.db
        .delete(student)
        .where(eq(student.id, id))
        .returning({ id: student.id });

      if (deleted.length === 0) {
        throw new NotFoundException('学生不存在');
      }

      this.logger.log(`删除学生成功: id=${id}`);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`删除学生失败: id=${id}`, error as string);
      throw error;
    }
  }

  async getByClassId(classId: string): Promise<Student[]> {
    try {
      const results = await this.db
        .select()
        .from(student)
        .where(eq(student.classId, classId))
        .orderBy(student.name);

      return results.map((item) => this.mapToStudent(item));
    } catch (error) {
      this.logger.error(`按班级获取学生列表失败: classId=${classId}`, error as string);
      throw error;
    }
  }

  /**
   * 根据年级和班级名查找或创建班级，返回 classId
   */
  private async ensureClassId(grade: string, className: string): Promise<string> {
    const existing = await this.db
      .select({ id: homeroomClass.id })
      .from(homeroomClass)
      .where(
        and(
          eq(homeroomClass.grade, grade),
          eq(homeroomClass.className, className),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      return existing[0].id;
    }

    const created = await this.db
      .insert(homeroomClass)
      .values({
        grade,
        className,
      })
      .returning({ id: homeroomClass.id });

    this.logger.log(`自动创建班级: grade=${grade}, className=${className}`);
    return created[0].id;
  }

  private mapToStudent(row: typeof student.$inferSelect): Student {
    return {
      id: row.id,
      name: row.name,
      grade: row.grade as Student['grade'],
      className: row.className,
      classId: row.classId ?? undefined,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
