import {
  Injectable,
  Inject,
  Logger,
  UnauthorizedException,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import {
  DRIZZLE_DATABASE,
  type PostgresJsDatabase,
} from '../../platform-shim';
import { eq, and, sql, desc } from 'drizzle-orm';
import { headTeacher, homeroomClass, accessRequest } from '@server/database/schema';
import type { CurrentUser, UserRole, RegisterDto, Grade, BindAccountResponse, AccessRequest, AccessRequestStatus } from '@shared/api.interface';

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
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async login(
    account: string,
    password: string,
  ): Promise<{
    user: CurrentUser;
    token: string;
  }> {
    try {
      const users = await this.db
        .select({
          id: headTeacher.id,
          name: headTeacher.name,
          grade: headTeacher.grade,
          className: headTeacher.className,
          classId: headTeacher.classId,
          role: headTeacher.role,
        })
        .from(headTeacher)
        .where(
          and(
            eq(headTeacher.account, account),
            eq(headTeacher.password, password),
          ),
        );

      if (users.length === 0) {
        this.logger.warn(`登录失败：账号 ${account} 或密码错误`);
        throw new UnauthorizedException('账号或密码错误');
      }

      const record = users[0];
      const role = (record.role || 'teacher') as UserRole;

      const user: CurrentUser = {
        userId: record.id,
        name: record.name,
        role,
        teacherId: record.id,
        grade: record.grade as CurrentUser['grade'],
        className: record.className,
        classId: record.classId,
      };

      const token = record.id;

      this.logger.log(`登录成功：${record.name} (${account})，角色：${role}`);
      return { user, token };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error(
        `登录异常：${account}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  async register(
    dto: RegisterDto,
  ): Promise<{ success: boolean; message: string; user?: CurrentUser }> {
    if (!dto.account || !dto.password || !dto.name || !dto.role) {
      throw new BadRequestException('账号、密码、姓名、身份不能为空');
    }

    if (dto.password.length < 6) {
      throw new BadRequestException('密码长度不能少于6位');
    }

    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('两次输入的密码不一致');
    }

    const validRoles: UserRole[] = ['teacher', 'grade_head', 'grade_director', 'school_leader'];
    if (!validRoles.includes(dto.role)) {
      throw new BadRequestException('无效的身份选择');
    }

    if ((dto.role === 'teacher' || dto.role === 'grade_head' || dto.role === 'grade_director') && !dto.grade) {
      throw new BadRequestException('请选择年级');
    }

    if (dto.role === 'teacher' && !dto.className) {
      throw new BadRequestException('请填写班级');
    }

    try {
      const existing = await this.db
        .select({ id: headTeacher.id })
        .from(headTeacher)
        .where(eq(headTeacher.account, dto.account));

      if (existing.length > 0) {
        throw new ConflictException('该账号已被注册，请更换账号');
      }

      let classId: string | undefined;
      let className = dto.className || '';
      const grade = dto.grade as Grade | undefined;

      if (dto.role === 'teacher' && grade && className) {
        const classes = await this.db
          .select({ id: homeroomClass.id })
          .from(homeroomClass)
          .where(
            sql`${homeroomClass.grade} = ${grade} AND ${homeroomClass.className} = ${className}`,
          );
        if (classes.length > 0) {
          classId = classes[0].id;
        } else {
          const inserted = await this.db
            .insert(homeroomClass)
            .values({ grade, className })
            .returning({ id: homeroomClass.id });
          classId = inserted[0].id;
        }
      }

      const insertResult = await this.db.insert(headTeacher).values({
        account: dto.account,
        password: dto.password,
        name: dto.name,
        role: dto.role,
        grade: grade ?? 'grade_1',
        className: className || '1班',
        classId,
      }).returning({
        id: headTeacher.id,
        name: headTeacher.name,
        grade: headTeacher.grade,
        className: headTeacher.className,
        classId: headTeacher.classId,
        role: headTeacher.role,
      });

      const inserted = insertResult[0];
      const role = (inserted.role || 'teacher') as UserRole;

      this.logger.log(`注册成功：${dto.name} (${dto.account})，角色：${role}`);

      const user: CurrentUser = {
        userId: inserted.id,
        name: inserted.name,
        role,
        teacherId: inserted.id,
        grade: inserted.grade as CurrentUser['grade'],
        className: inserted.className,
        classId: inserted.classId,
      };

      return { success: true, message: '注册成功', user };
    } catch (error) {
      if (error instanceof ConflictException || error instanceof BadRequestException) {
        throw error;
      }
      const code = extractPostgresErrorCode(error);
      if (code === '23505') {
        throw new ConflictException('该账号已被注册，请更换账号');
      }
      this.logger.error(
        `注册异常：${dto.account}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  async getCurrentUser(
    teacherId: string,
  ): Promise<CurrentUser> {
    try {
      if (!teacherId) {
        throw new UnauthorizedException('未登录');
      }

      const teachers = await this.db
        .select({
          id: headTeacher.id,
          name: headTeacher.name,
          grade: headTeacher.grade,
          className: headTeacher.className,
          classId: headTeacher.classId,
          role: headTeacher.role,
        })
        .from(headTeacher)
        .where(eq(headTeacher.id, teacherId));

      if (teachers.length === 0) {
        this.logger.warn(`未找到用户信息：teacherId=${teacherId}`);
        throw new UnauthorizedException('用户不存在或已失效');
      }

      const teacher = teachers[0];
      const role = (teacher.role || 'teacher') as UserRole;

      this.logger.log(`获取用户信息：${teacher.name} (${role})`);
      return {
        userId: teacher.id,
        name: teacher.name,
        role,
        teacherId: teacher.id,
        grade: teacher.grade as CurrentUser['grade'],
        className: teacher.className,
        classId: teacher.classId,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `获取当前用户信息异常：${teacherId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  async bindAccount(
    teacherId: string,
    account: string,
    password: string,
  ): Promise<BindAccountResponse> {
    if (!teacherId) {
      throw new UnauthorizedException('未登录，无法绑定账号');
    }
    if (!account || !password) {
      throw new BadRequestException('账号和密码不能为空');
    }

    const users = await this.db
      .select({
        id: headTeacher.id,
        name: headTeacher.name,
        grade: headTeacher.grade,
        className: headTeacher.className,
        classId: headTeacher.classId,
        role: headTeacher.role,
      })
      .from(headTeacher)
      .where(
        and(
          eq(headTeacher.account, account),
          eq(headTeacher.password, password),
        ),
      );

    if (users.length === 0) {
      this.logger.warn(`绑定失败：账号 ${account} 或密码错误`);
      throw new UnauthorizedException('账号或密码错误');
    }

    const record = users[0];
    const role = (record.role || 'teacher') as UserRole;
    const user: CurrentUser = {
      userId: record.id,
      name: record.name,
      role,
      teacherId: record.id,
      grade: record.grade as CurrentUser['grade'],
      className: record.className,
      classId: record.classId,
    };

    return { user, message: '绑定成功' };
  }

  async getMyAccessRequest(
    teacherId: string,
  ): Promise<AccessRequest | null> {
    // 保留接口但返回 null（access-request 模块已废弃）
    return null;
  }
}
