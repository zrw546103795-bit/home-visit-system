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
import { eq, and, desc } from 'drizzle-orm';
import { homeroomClass, headTeacher } from '@server/database/schema';
import type { HomeroomClass, Grade, GRADE_LABELS as GradeLabelsType } from '@shared/api.interface';
import { GRADE_LABELS } from '@shared/api.interface';

interface ClassGroup {
  grade: Grade;
  gradeLabel: string;
  classes: HomeroomClass[];
}

interface CreateClassDto {
  grade: Grade;
  className: string;
}

interface UpdateClassDto {
  grade?: Grade;
  className?: string;
}

function extractPostgresErrorCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current && typeof current === 'object'; depth += 1) {
    const { code, cause } = current as { code?: unknown; cause?: unknown };
    if (typeof code === 'string') return code;
    current = cause;
  }
  return undefined;
}

function mapClass(row: typeof homeroomClass.$inferSelect): HomeroomClass {
  return {
    id: row.id,
    grade: row.grade as Grade,
    className: row.className,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class ClassService {
  private readonly logger = new Logger(ClassService.name);

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

  async list(): Promise<ClassGroup[]> {
    try {
      const rows = await this.db
        .select()
        .from(homeroomClass)
        .orderBy(desc(homeroomClass.createdAt));

      const groups = new Map<Grade, HomeroomClass[]>();
      const gradeOrder: Grade[] = ['grade_1', 'grade_2', 'grade_3'];

      for (const g of gradeOrder) {
        groups.set(g, []);
      }

      for (const row of rows) {
        const grade = row.grade as Grade;
        const list = groups.get(grade) ?? [];
        list.push(mapClass(row));
        groups.set(grade, list);
      }

      const result: ClassGroup[] = [];
      for (const grade of gradeOrder) {
        const classes = groups.get(grade) ?? [];
        result.push({
          grade,
          gradeLabel: GRADE_LABELS[grade],
          classes,
        });
      }

      return result;
    } catch (error) {
      this.logger.error('获取班级列表失败', JSON.stringify(error));
      throw error;
    }
  }

  async getById(id: string): Promise<HomeroomClass> {
    try {
      const rows = await this.db
        .select()
        .from(homeroomClass)
        .where(eq(homeroomClass.id, id));

      if (rows.length === 0) {
        throw new NotFoundException('班级不存在');
      }

      return mapClass(rows[0]);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`获取班级失败 id=${id}`, JSON.stringify(error));
      throw error;
    }
  }

  async findByGradeAndClassName(
    grade: Grade,
    className: string,
  ): Promise<HomeroomClass | null> {
    const rows = await this.db
      .select()
      .from(homeroomClass)
      .where(
        and(
          eq(homeroomClass.grade, grade),
          eq(homeroomClass.className, className),
        ),
      );

    return rows.length > 0 ? mapClass(rows[0]) : null;
  }

  async create(dto: CreateClassDto): Promise<HomeroomClass> {
    if (!dto.grade || !dto.className) {
      throw new BadRequestException('年级和班级名称不能为空');
    }

    try {
      const inserted = await this.db
        .insert(homeroomClass)
        .values({
          grade: dto.grade,
          className: dto.className,
        })
        .returning();

      return mapClass(inserted[0]);
    } catch (error) {
      const code = extractPostgresErrorCode(error);
      if (code === '23505') {
        throw new ConflictException('该年级下已存在同名班级');
      }
      this.logger.error('创建班级失败', JSON.stringify(error));
      throw error;
    }
  }

  async update(id: string, dto: UpdateClassDto): Promise<HomeroomClass> {
    const patch: Partial<typeof homeroomClass.$inferInsert> = {};
    if (dto.grade !== undefined) patch.grade = dto.grade;
    if (dto.className !== undefined) patch.className = dto.className;

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    try {
      const updated = await this.db
        .update(homeroomClass)
        .set(patch)
        .where(eq(homeroomClass.id, id))
        .returning();

      if (updated.length === 0) {
        throw new NotFoundException('班级不存在');
      }

      return mapClass(updated[0]);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      const code = extractPostgresErrorCode(error);
      if (code === '23505') {
        throw new ConflictException('该年级下已存在同名班级');
      }
      this.logger.error(`更新班级失败 id=${id}`, JSON.stringify(error));
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    try {
      const deleted = await this.db
        .delete(homeroomClass)
        .where(eq(homeroomClass.id, id))
        .returning({ id: homeroomClass.id });

      if (deleted.length === 0) {
        throw new NotFoundException('班级不存在');
      }
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      const code = extractPostgresErrorCode(error);
      if (code === '23503') {
        throw new ConflictException('该班级下存在关联数据，无法删除');
      }
      this.logger.error(`删除班级失败 id=${id}`, JSON.stringify(error));
      throw error;
    }
  }

  async getOrCreateClass(
    grade: Grade,
    className: string,
  ): Promise<HomeroomClass> {
    const existing = await this.findByGradeAndClassName(grade, className);
    if (existing) return existing;
    return this.create({ grade, className });
  }
}
