import { Injectable, Inject, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '../../platform-shim';
import {
  headTeacher,
  student,
  homeroomClass,
} from '@server/database/schema';
import { eq, and } from 'drizzle-orm';
import type {
  CreateTeacherDto,
  CreateStudentDto,
  ImportResult,
  Grade,
} from '@shared/api.interface';
import { GRADE_LABELS } from '@shared/api.interface';

interface TemplateField {
  field: string;
  label: string;
  required: boolean;
  description: string;
}

interface TemplateResponse {
  fields: TemplateField[];
  example: Record<string, string>;
}

const VALID_GRADES: Grade[] = ['grade_1', 'grade_2', 'grade_3'];

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase) {}

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

  private async ensureClass(
    tx: PostgresJsDatabase,
    grade: string,
    className: string,
  ): Promise<string> {
    const existing = await tx
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

    const inserted = await tx
      .insert(homeroomClass)
      .values({ grade, className })
      .returning({ id: homeroomClass.id });

    return inserted[0].id;
  }

  private validateGrade(grade: string): boolean {
    return VALID_GRADES.includes(grade as Grade);
  }

  async importTeachers(data: CreateTeacherDto[]): Promise<ImportResult> {
    if (!data || data.length === 0) {
      throw new BadRequestException('导入数据不能为空');
    }

    const total = data.length;
    let success = 0;
    const errors: string[] = [];

    try {
      await this.db.transaction(async (tx) => {
        for (let i = 0; i < data.length; i += 1) {
          const item = data[i];
          const rowNum = i + 1;

          try {
            if (!item.name) {
              errors.push(`第${rowNum}行：姓名不能为空`);
              continue;
            }
            if (!item.account) {
              errors.push(`第${rowNum}行：账号不能为空`);
              continue;
            }
            if (!item.password) {
              errors.push(`第${rowNum}行：密码不能为空`);
              continue;
            }
            if (!this.validateGrade(item.grade)) {
              errors.push(
                `第${rowNum}行：年级无效，有效值为 grade_1/grade_2/grade_3`,
              );
              continue;
            }
            if (!item.className) {
              errors.push(`第${rowNum}行：班级不能为空`);
              continue;
            }

            const classId = await this.ensureClass(tx, item.grade, item.className);

            const existing = await tx
              .select({ id: headTeacher.id })
              .from(headTeacher)
              .where(eq(headTeacher.account, item.account))
              .limit(1);

            if (existing.length > 0) {
              await tx
                .update(headTeacher)
                .set({
                  name: item.name,
                  password: item.password,
                  grade: item.grade,
                  className: item.className,
                  classId,
                })
                .where(eq(headTeacher.id, existing[0].id));
            } else {
              await tx.insert(headTeacher).values({
                name: item.name,
                account: item.account,
                password: item.password,
                grade: item.grade,
                className: item.className,
                classId,
              });
            }

            success += 1;
          } catch (itemError) {
            const message =
              itemError instanceof Error ? itemError.message : '未知错误';
            errors.push(`第${rowNum}行：${message}`);
          }
        }
      });
    } catch (error) {
      this.logger.error('批量导入班主任失败', error);
      throw error;
    }

    this.logger.log(
      `班主任导入完成：总共${total}条，成功${success}条，失败${total - success}条`,
    );

    return {
      total,
      success,
      failed: total - success,
      errors,
    };
  }

  async importStudents(data: CreateStudentDto[]): Promise<ImportResult> {
    if (!data || data.length === 0) {
      throw new BadRequestException('导入数据不能为空');
    }

    const total = data.length;
    let success = 0;
    const errors: string[] = [];

    try {
      await this.db.transaction(async (tx) => {
        for (let i = 0; i < data.length; i += 1) {
          const item = data[i];
          const rowNum = i + 1;

          try {
            if (!item.name) {
              errors.push(`第${rowNum}行：姓名不能为空`);
              continue;
            }
            if (!this.validateGrade(item.grade)) {
              errors.push(
                `第${rowNum}行：年级无效，有效值为 grade_1/grade_2/grade_3`,
              );
              continue;
            }
            if (!item.className) {
              errors.push(`第${rowNum}行：班级不能为空`);
              continue;
            }

            const classId = await this.ensureClass(tx, item.grade, item.className);

            const existing = await tx
              .select({ id: student.id })
              .from(student)
              .where(
                and(
                  eq(student.grade, item.grade),
                  eq(student.className, item.className),
                  eq(student.name, item.name),
                ),
              )
              .limit(1);

            if (existing.length > 0) {
              errors.push(
                `第${rowNum}行：学生"${item.name}"(${item.grade}${item.className})已存在，已跳过`,
              );
              continue;
            }

            await tx.insert(student).values({
              name: item.name,
              grade: item.grade,
              className: item.className,
              classId,
            });

            success += 1;
          } catch (itemError) {
            const message =
              itemError instanceof Error ? itemError.message : '未知错误';
            errors.push(`第${rowNum}行：${message}`);
          }
        }
      });
    } catch (error) {
      this.logger.error('批量导入学生失败', error);
      throw error;
    }

    this.logger.log(
      `学生导入完成：总共${total}条，成功${success}条，失败${total - success}条`,
    );

    return {
      total,
      success,
      failed: total - success,
      errors,
    };
  }

  getTeacherTemplate(): TemplateResponse {
    const fields: TemplateField[] = [
      { field: 'name', label: '姓名', required: true, description: '班主任姓名' },
      { field: 'account', label: '账号', required: true, description: '登录账号，唯一标识' },
      { field: 'password', label: '密码', required: true, description: '登录密码' },
      {
        field: 'grade',
        label: '年级',
        required: true,
        description: `年级编码：grade_1(${GRADE_LABELS.grade_1}) / grade_2(${GRADE_LABELS.grade_2}) / grade_3(${GRADE_LABELS.grade_3})`,
      },
      { field: 'className', label: '班级', required: true, description: '班级名称，如"1班"' },
    ];

    const example: Record<string, string> = {
      name: '张老师',
      account: 'zhangsan',
      password: '123456',
      grade: 'grade_1',
      className: '1班',
    };

    return { fields, example };
  }

  getStudentTemplate(): TemplateResponse {
    const fields: TemplateField[] = [
      { field: 'name', label: '姓名', required: true, description: '学生姓名' },
      {
        field: 'grade',
        label: '年级',
        required: true,
        description: `年级编码：grade_1(${GRADE_LABELS.grade_1}) / grade_2(${GRADE_LABELS.grade_2}) / grade_3(${GRADE_LABELS.grade_3})`,
      },
      { field: 'className', label: '班级', required: true, description: '班级名称，如"1班"' },
    ];

    const example: Record<string, string> = {
      name: '李明',
      grade: 'grade_1',
      className: '1班',
    };

    return { fields, example };
  }
}
