import { Injectable, Inject, Logger, UnauthorizedException } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '../../platform-shim';
import {
  homeVisitRecord,
  headTeacher,
  student,
  homeroomClass,
} from '@server/database/schema';
import {
  eq,
  and,
  count,
  gte,
  lt,
  sql,
  desc,
} from 'drizzle-orm';
import type {
  StatsOverview,
  GradeStatsItem,
  CategoryStatsItem,
  FormStatsItem,
  Grade,
  VisitCategory,
  VisitForm,
  UserRole,
} from '@shared/api.interface';
import {
  GRADE_LABELS,
  VISIT_CATEGORY_LABELS,
  VISIT_FORM_LABELS,
} from '@shared/api.interface';
import type { SQL } from 'drizzle-orm';
import { getDataScope } from '@server/common/utils/permission';

@Injectable()
export class StatsService {
  private readonly logger = new Logger(StatsService.name);

  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase) {}

  /**
   * 根据 teacherId 解析用户角色、年级、班级信息
   * - teacher 不存在 → 抛 UnauthorizedException
   * - admin 角色 → 全部数据
   * - 其他角色 → 按 head_teacher 表的 grade/className 返回
   */
  async resolveUserInfo(
    teacherId: string,
  ): Promise<{
    role: UserRole;
    userGrade?: Grade;
    userClassName?: string;
  }> {
    if (!teacherId) {
      throw new UnauthorizedException('未登录');
    }

    const teacherResult = await this.db
      .select({
        grade: headTeacher.grade,
        className: headTeacher.className,
        role: headTeacher.role,
      })
      .from(headTeacher)
      .where(eq(headTeacher.id, teacherId))
      .limit(1);

    if (teacherResult.length === 0) {
      throw new UnauthorizedException('用户不存在或已失效');
    }

    const t = teacherResult[0];
    const role = (t.role || 'teacher') as UserRole;

    if (role === 'admin' || role === 'school_leader') {
      return { role };
    }

    return {
      role,
      userGrade: t.grade as Grade,
      userClassName: t.className,
    };
  }

  private getMonthRange(monthStr?: string): { start: string; end: string } {
    const now = new Date();
    let year: number;
    let month: number;

    if (monthStr && /^\d{4}-\d{2}$/.test(monthStr)) {
      [year, month] = monthStr.split('-').map(Number);
    } else {
      year = now.getFullYear();
      month = now.getMonth() + 1;
    }

    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const end = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

    return { start, end };
  }

  /**
   * 根据数据范围构造 home_visit_record 表的 where 条件数组
   * homeVisitRecord 没有 className 字段，按 className 过滤时用 classId 子查询
   */
  private buildRecordScopeConditions(
    scope: ReturnType<typeof getDataScope>,
  ): SQL[] {
    const conditions: SQL[] = [];
    if (scope.isAll) return conditions;
    if (scope.grade) {
      conditions.push(eq(homeVisitRecord.grade, scope.grade));
    }
    if (scope.className) {
      conditions.push(sql`${homeVisitRecord.classId} IN (${
        this.db
          .select({ id: homeroomClass.id })
          .from(homeroomClass)
          .where(
            and(
              eq(homeroomClass.grade, scope.grade!),
              eq(homeroomClass.className, scope.className),
            ),
          )
      })`);
    }
    return conditions;
  }

  /**
   * 根据数据范围构造 head_teacher / student 表的 where 条件数组
   * （这些表同时有 grade 和 className 字段）
   */
  private buildEntityScopeConditions(
    scope: ReturnType<typeof getDataScope>,
    table: typeof headTeacher | typeof student,
  ): SQL[] {
    const conditions: SQL[] = [];
    if (scope.isAll) return conditions;
    if (scope.grade) {
      conditions.push(eq(table.grade, scope.grade));
    }
    if (scope.className) {
      conditions.push(eq(table.className, scope.className));
    }
    return conditions;
  }

  /**
   * 根据数据范围构造 homeroom_class 表的 where 条件数组
   */
  private buildClassScopeConditions(
    scope: ReturnType<typeof getDataScope>,
  ): SQL[] {
    const conditions: SQL[] = [];
    if (scope.isAll) return conditions;
    if (scope.grade) {
      conditions.push(eq(homeroomClass.grade, scope.grade));
    }
    if (scope.className) {
      conditions.push(eq(homeroomClass.className, scope.className));
    }
    return conditions;
  }

  async getOverview(
    role: UserRole,
    userGrade?: Grade,
    userClassName?: string,
  ): Promise<StatsOverview> {
    try {
      const scope = getDataScope(role, userGrade, userClassName);
      const { start, end } = this.getMonthRange();

      const recordConditions = this.buildRecordScopeConditions(scope);
      const teacherConditions = this.buildEntityScopeConditions(scope, headTeacher);
      const studentConditions = this.buildEntityScopeConditions(scope, student);
      const classConditions = this.buildClassScopeConditions(scope);

      const totalRecordsPromise = this.db
        .select({ value: count() })
        .from(homeVisitRecord)
        .where(recordConditions.length > 0 ? and(...recordConditions) : undefined);

      const totalTeachersPromise = this.db
        .select({ value: count() })
        .from(headTeacher)
        .where(teacherConditions.length > 0 ? and(...teacherConditions) : undefined);

      const totalStudentsPromise = this.db
        .select({ value: count() })
        .from(student)
        .where(studentConditions.length > 0 ? and(...studentConditions) : undefined);

      const totalClassesPromise = this.db
        .select({ value: count() })
        .from(homeroomClass)
        .where(classConditions.length > 0 ? and(...classConditions) : undefined);

      const monthConditions: SQL[] = [...recordConditions];
      monthConditions.push(gte(homeVisitRecord.visitDate, start));
      monthConditions.push(lt(homeVisitRecord.visitDate, end));

      const thisMonthRecordsPromise = this.db
        .select({ value: count() })
        .from(homeVisitRecord)
        .where(and(...monthConditions));

      const [
        totalRecordsResult,
        totalTeachersResult,
        totalStudentsResult,
        totalClassesResult,
        thisMonthRecordsResult,
      ] = await Promise.all([
        totalRecordsPromise,
        totalTeachersPromise,
        totalStudentsPromise,
        totalClassesPromise,
        thisMonthRecordsPromise,
      ]);

      return {
        totalRecords: Number(totalRecordsResult[0].value),
        totalTeachers: Number(totalTeachersResult[0].value),
        totalStudents: Number(totalStudentsResult[0].value),
        totalClasses: Number(totalClassesResult[0].value),
        thisMonthRecords: Number(thisMonthRecordsResult[0].value),
      };
    } catch (error) {
      this.logger.error('获取概览统计失败', error);
      throw error;
    }
  }

  async getGradeStats(
    month: string | undefined,
    role: UserRole,
    userGrade?: Grade,
    userClassName?: string,
  ): Promise<GradeStatsItem[]> {
    try {
      // teacher 角色不返回年级统计
      if (role === 'teacher') {
        return [];
      }

      const scope = getDataScope(role, userGrade, userClassName);
      const { start, end } = this.getMonthRange(month);

      const conditions: SQL[] = [
        ...this.buildRecordScopeConditions(scope),
      ];
      conditions.push(gte(homeVisitRecord.visitDate, start));
      conditions.push(lt(homeVisitRecord.visitDate, end));

      const results = await this.db
        .select({
          grade: homeVisitRecord.grade,
          count: count(),
        })
        .from(homeVisitRecord)
        .where(and(...conditions))
        .groupBy(homeVisitRecord.grade)
        .orderBy(homeVisitRecord.grade);

      return results.map((item) => ({
        grade: item.grade as Grade,
        gradeLabel: GRADE_LABELS[item.grade as Grade] || item.grade,
        count: Number(item.count),
      }));
    } catch (error) {
      this.logger.error('获取年级统计失败', error);
      throw error;
    }
  }

  async getCategoryStats(
    month: string | undefined,
    grade: string | undefined,
    role: UserRole,
    userGrade?: Grade,
    userClassName?: string,
  ): Promise<CategoryStatsItem[]> {
    try {
      const scope = getDataScope(role, userGrade, userClassName);
      const { start, end } = this.getMonthRange(month);

      const conditions: SQL[] = [
        ...this.buildRecordScopeConditions(scope),
      ];
      conditions.push(gte(homeVisitRecord.visitDate, start));
      conditions.push(lt(homeVisitRecord.visitDate, end));
      if (grade) {
        conditions.push(eq(homeVisitRecord.grade, grade));
      }

      const results = await this.db
        .select({
          category: homeVisitRecord.category,
          count: count(),
        })
        .from(homeVisitRecord)
        .where(and(...conditions))
        .groupBy(homeVisitRecord.category)
        .orderBy(homeVisitRecord.category);

      return results.map((item) => ({
        category: item.category as VisitCategory,
        categoryLabel:
          VISIT_CATEGORY_LABELS[item.category as VisitCategory] || item.category,
        count: Number(item.count),
      }));
    } catch (error) {
      this.logger.error('获取类别统计失败', error);
      throw error;
    }
  }

  async getFormStats(
    month: string | undefined,
    grade: string | undefined,
    role: UserRole,
    userGrade?: Grade,
    userClassName?: string,
  ): Promise<FormStatsItem[]> {
    try {
      const scope = getDataScope(role, userGrade, userClassName);
      const { start, end } = this.getMonthRange(month);

      const conditions: SQL[] = [
        ...this.buildRecordScopeConditions(scope),
      ];
      conditions.push(gte(homeVisitRecord.visitDate, start));
      conditions.push(lt(homeVisitRecord.visitDate, end));
      if (grade) {
        conditions.push(eq(homeVisitRecord.grade, grade));
      }

      const results = await this.db
        .select({
          form: homeVisitRecord.visitForm,
          count: count(),
        })
        .from(homeVisitRecord)
        .where(and(...conditions))
        .groupBy(homeVisitRecord.visitForm)
        .orderBy(homeVisitRecord.visitForm);

      return results.map((item) => ({
        form: item.form as VisitForm,
        formLabel:
          VISIT_FORM_LABELS[item.form as VisitForm] || item.form,
        count: Number(item.count),
      }));
    } catch (error) {
      this.logger.error('获取形式统计失败', error);
      throw error;
    }
  }

  async getMonthlyTrend(
    role: UserRole,
    userGrade?: Grade,
    userClassName?: string,
  ): Promise<{ month: string; count: number }[]> {
    try {
      const scope = getDataScope(role, userGrade, userClassName);

      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      const months: string[] = [];
      for (let i = 11; i >= 0; i -= 1) {
        const d = new Date(currentYear, currentMonth - 1 - i, 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        months.push(`${y}-${m}`);
      }

      const startDate = `${months[0]}-01`;
      const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
      const nextYear = currentMonth === 12 ? currentYear + 1 : currentMonth;
      const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

      const conditions: SQL[] = [
        ...this.buildRecordScopeConditions(scope),
      ];
      conditions.push(gte(homeVisitRecord.visitDate, startDate));
      conditions.push(lt(homeVisitRecord.visitDate, endDate));

      const monthExpr = sql<string>`to_char(${homeVisitRecord.visitDate}, 'YYYY-MM')`;

      const results = await this.db
        .select({
          month: monthExpr,
          count: count(),
        })
        .from(homeVisitRecord)
        .where(and(...conditions))
        .groupBy(monthExpr)
        .orderBy(desc(monthExpr));

      const countMap = new Map<string, number>();
      for (const row of results) {
        countMap.set(row.month, Number(row.count));
      }

      return months.map((m: string) => ({
        month: m,
        count: countMap.get(m) || 0,
      }));
    } catch (error) {
      this.logger.error('获取月度趋势失败', error);
      throw error;
    }
  }
}
