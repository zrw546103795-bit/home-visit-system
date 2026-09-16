import {
  Injectable,
  Inject,
  Logger,
  ConflictException,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  DRIZZLE_DATABASE,
  type PostgresJsDatabase,
} from '../../platform-shim';
import { eq, and, desc, count, ilike } from 'drizzle-orm';
import { headTeacher } from '@server/database/schema';
import type {
  HeadTeacher,
  TeacherListParams,
  PaginatedResponse,
  CreateTeacherDto,
  UpdateTeacherDto,
  Grade,
  UserRole,
} from '@shared/api.interface';
import { ClassService } from '../class/class.service';

function extractPostgresErrorCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current && typeof current === 'object'; depth += 1) {
    const { code, cause } = current as { code?: unknown; cause?: unknown };
    if (typeof code === 'string') return code;
    current = cause;
  }
  return undefined;
}

function mapTeacher(row: typeof headTeacher.$inferSelect): HeadTeacher {
  return {
    id: row.id,
    userId: row.userId ?? undefined,
    name: row.name,
    account: row.account ?? undefined,
    grade: row.grade as Grade,
    className: row.className,
    classId: row.classId ?? undefined,
    role: (row.role || 'teacher') as UserRole,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class TeacherService {
  private readonly logger = new Logger(TeacherService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly classService: ClassService,
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

  async list(params: TeacherListParams): Promise<PaginatedResponse<HeadTeacher>> {
    const { page, pageSize, name, grade } = params;
    const offset = (page - 1) * pageSize;

    const conditions = [];
    if (name) conditions.push(ilike(headTeacher.name, `%${name}%`));
    if (grade) conditions.push(eq(headTeacher.grade, grade));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    try {
      const [countResult, rows] = await Promise.all([
        this.db
          .select({ count: count() })
          .from(headTeacher)
          .where(whereClause),
        this.db
          .select()
          .from(headTeacher)
          .where(whereClause)
          .orderBy(desc(headTeacher.createdAt))
          .limit(pageSize)
          .offset(offset),
      ]);

      const total = Number(countResult[0]?.count ?? 0);
      const items = rows.map(mapTeacher);

      return {
        items,
        total,
        page,
        pageSize,
      };
    } catch (error) {
      this.logger.error('获取班主任列表失败', JSON.stringify(error));
      throw error;
    }
  }

  async getById(id: string): Promise<HeadTeacher> {
    try {
      const rows = await this.db
        .select()
        .from(headTeacher)
        .where(eq(headTeacher.id, id));

      if (rows.length === 0) {
        throw new NotFoundException('班主任不存在');
      }

      return mapTeacher(rows[0]);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`获取班主任失败 id=${id}`, JSON.stringify(error));
      throw error;
    }
  }

  async create(dto: CreateTeacherDto): Promise<HeadTeacher> {
    if (!dto.name || !dto.grade || !dto.className) {
      throw new BadRequestException('姓名、年级和班级不能为空');
    }

    try {
      // 先确保班级存在
      const cls = await this.classService.getOrCreateClass(
        dto.grade,
        dto.className,
      );

      const inserted = await this.db
        .insert(headTeacher)
        .values({
          name: dto.name,
          account: dto.account,
          password: dto.password,
          grade: dto.grade,
          className: dto.className,
          classId: cls.id,
          role: dto.role ?? 'teacher',
        })
        .returning();

      return mapTeacher(inserted[0]);
    } catch (error) {
      const code = extractPostgresErrorCode(error);
      if (code === '23505') {
        throw new ConflictException('班主任已存在');
      }
      this.logger.error('创建班主任失败', JSON.stringify(error));
      throw error;
    }
  }

  async update(id: string, dto: UpdateTeacherDto): Promise<HeadTeacher> {
    const patch: Partial<typeof headTeacher.$inferInsert> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.password !== undefined) patch.password = dto.password;
    if (dto.role !== undefined) patch.role = dto.role;

    // 如果年级或班级变化，需要重新关联班级
    let newClassId: string | undefined;
    if (dto.grade !== undefined || dto.className !== undefined) {
      // 先获取当前记录以确定 grade/className
      const current = await this.db
        .select()
        .from(headTeacher)
        .where(eq(headTeacher.id, id));

      if (current.length === 0) {
        throw new NotFoundException('班主任不存在');
      }

      const newGrade = dto.grade ?? (current[0].grade as Grade);
      const newClassName = dto.className ?? current[0].className;

      const cls = await this.classService.getOrCreateClass(
        newGrade,
        newClassName,
      );
      newClassId = cls.id;

      if (dto.grade !== undefined) patch.grade = dto.grade;
      if (dto.className !== undefined) patch.className = dto.className;
      patch.classId = newClassId;
    }

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    try {
      const updated = await this.db
        .update(headTeacher)
        .set(patch)
        .where(eq(headTeacher.id, id))
        .returning();

      if (updated.length === 0) {
        throw new NotFoundException('班主任不存在');
      }

      return mapTeacher(updated[0]);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      const code = extractPostgresErrorCode(error);
      if (code === '23505') {
        throw new ConflictException('更新冲突');
      }
      this.logger.error(`更新班主任失败 id=${id}`, JSON.stringify(error));
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    try {
      const deleted = await this.db
        .delete(headTeacher)
        .where(eq(headTeacher.id, id))
        .returning({ id: headTeacher.id });

      if (deleted.length === 0) {
        throw new NotFoundException('班主任不存在');
      }
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      const code = extractPostgresErrorCode(error);
      if (code === '23503') {
        throw new ConflictException('该班主任存在关联数据，无法删除');
      }
      this.logger.error(`删除班主任失败 id=${id}`, JSON.stringify(error));
      throw error;
    }
  }
}
