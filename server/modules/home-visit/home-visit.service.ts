import {
  Injectable,
  Inject,
  Logger,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  DRIZZLE_DATABASE,
  FileService,
  type PostgresJsDatabase,
} from '../../platform-shim';
import { eq, and, count, desc, sql, gte, lte, lt, like, inArray } from 'drizzle-orm';
import {
  homeVisitRecord,
  homeVisitAttachment,
  headTeacher,
  homeroomClass,
} from '@server/database/schema';
import { getDataScope, checkRecordPermission } from '@server/common/utils/permission';
import type {
  HomeVisitRecord,
  HomeVisitAttachment,
  PaginatedResponse,
  RecordListParams,
  CreateRecordDto,
  UpdateRecordDto,
  UserRole,
  Grade,
  VisitForm,
  VisitCategory,
} from '@shared/api.interface';
import {
  GRADE_LABELS,
  VISIT_FORM_LABELS,
  VISIT_CATEGORY_LABELS,
} from '@shared/api.interface';

interface TeacherInfo {
  id: string;
  name: string;
  grade: string;
  className: string;
  classId: string | undefined;
  role: string;
}

@Injectable()
export class HomeVisitService {
  private readonly logger = new Logger(HomeVisitService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly fileService: FileService,
  ) {}

  /**
   * 根据 teacherId 查找班主任信息
   */
  private async getTeacherById(teacherId: string): Promise<TeacherInfo | null> {
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

    if (teachers.length === 0) return null;
    const t = teachers[0];
    return {
      id: t.id,
      name: t.name,
      grade: t.grade,
      className: t.className,
      classId: t.classId ?? undefined,
      role: t.role || 'teacher',
    };
  }

  /**
   * 解析当前用户角色
   */
  private async resolveRole(teacherId: string): Promise<UserRole> {
    if (!teacherId) {
      throw new UnauthorizedException('未登录');
    }
    const teacher = await this.getTeacherById(teacherId);
    if (!teacher) {
      throw new UnauthorizedException('用户不存在或已失效');
    }
    return teacher.role as UserRole;
  }

  /**
   * 获取当前用户的教师信息
   * admin/school_leader 也需要查 head_teacher 表确认身份
   */
  private async getCurrentTeacher(teacherId: string): Promise<TeacherInfo> {
    if (!teacherId) {
      throw new UnauthorizedException('未登录');
    }
    const teacher = await this.getTeacherById(teacherId);
    if (!teacher) {
      throw new ForbiddenException('未找到班主任信息，无权限操作');
    }
    return teacher;
  }

  /**
   * 解析当前用户的数据范围（grade / className）
   * admin/school_leader 返回 undefined
   */
  private async resolveUserScope(
    teacherId: string,
    role: UserRole,
  ): Promise<{ userGrade?: Grade; userClassName?: string }> {
    if (role === 'admin' || role === 'school_leader') {
      return {};
    }
    const teacher = await this.getCurrentTeacher(teacherId);
    return {
      userGrade: teacher.grade as Grade,
      userClassName: teacher.className,
    };
  }

  /**
   * 写操作权限校验
   */
  private assertWritePermission(
    role: UserRole,
    userGrade: Grade | undefined,
    userClassName: string | undefined,
    recordGrade: string,
    recordClassName: string | undefined,
  ): void {
    if (!checkRecordPermission(role, userGrade, userClassName, recordGrade, recordClassName)) {
      throw new ForbiddenException('无操作权限');
    }
  }

  /**
   * 家访记录列表（分页+筛选）
   */
   async list(
     params: RecordListParams,
     teacherId: string,
   ): Promise<PaginatedResponse<HomeVisitRecord>> {
     try {
       const role = await this.resolveRole(teacherId);
       const page = Math.max(1, params.page);
       const pageSize = Math.min(100, Math.max(1, params.pageSize));
       const offset = (page - 1) * pageSize;

       // 构建筛选条件
       const conditions = [];

       // 数据范围过滤
       const { userGrade, userClassName } = await this.resolveUserScope(
         teacherId,
         role,
       );
       const scope = getDataScope(role, userGrade, userClassName);
       if (!scope.isAll) {
         if (scope.grade) {
           conditions.push(eq(homeVisitRecord.grade, scope.grade));
         }
         if (scope.className) {
           const classIds = await this.db
             .select({ id: homeroomClass.id })
             .from(homeroomClass)
             .where(eq(homeroomClass.className, scope.className));
           if (classIds.length > 0) {
             conditions.push(
               inArray(
                 homeVisitRecord.classId,
                 classIds.map((c) => c.id),
               ),
             );
           } else {
             return { items: [], total: 0, page, pageSize };
           }
         }
       }

       if (params.teacherId) {
         conditions.push(eq(homeVisitRecord.teacherId, params.teacherId));
       }

      if (params.studentName) {
        conditions.push(
          like(homeVisitRecord.studentName, `%${params.studentName}%`),
        );
      }
      if (params.grade) {
        conditions.push(eq(homeVisitRecord.grade, params.grade));
      }
      if (params.className) {
        // 通过 classId 子查询实现 className 筛选
        const classIds = await this.db
          .select({ id: homeroomClass.id })
          .from(homeroomClass)
          .where(like(homeroomClass.className, `%${params.className}%`));
        if (classIds.length > 0) {
          conditions.push(
            inArray(
              homeVisitRecord.classId,
              classIds.map((c) => c.id),
            ),
          );
        } else {
          // 没有匹配的班级，直接返回空结果
          return { items: [], total: 0, page, pageSize };
        }
      }
      if (params.visitForm) {
        conditions.push(eq(homeVisitRecord.visitForm, params.visitForm));
      }
      if (params.category) {
        conditions.push(eq(homeVisitRecord.category, params.category));
      }
      if (params.month) {
        const monthStart = `${params.month}-01`;
        const [year, month] = params.month.split('-').map(Number);
        const nextMonthDate = new Date(year, month, 1);
        const nextMonth = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-01`;
        conditions.push(gte(homeVisitRecord.visitDate, monthStart));
        conditions.push(lt(homeVisitRecord.visitDate, nextMonth));
      }
      if (params.startDate) {
        conditions.push(gte(homeVisitRecord.visitDate, params.startDate));
      }
      if (params.endDate) {
        conditions.push(lte(homeVisitRecord.visitDate, params.endDate));
      }

      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      // 查询总数
      const countResult = await this.db
        .select({ count: count() })
        .from(homeVisitRecord)
        .where(whereClause);
      const total = Number(countResult[0]?.count ?? 0);

      // 查询列表
      const records = await this.db
        .select({
          id: homeVisitRecord.id,
          studentName: homeVisitRecord.studentName,
          studentId: homeVisitRecord.studentId,
          visitDate: homeVisitRecord.visitDate,
          visitForm: homeVisitRecord.visitForm,
          category: homeVisitRecord.category,
          summary: homeVisitRecord.summary,
          remark: homeVisitRecord.remark,
          teacherId: homeVisitRecord.teacherId,
          classId: homeVisitRecord.classId,
          grade: homeVisitRecord.grade,
          createdAt: sql<string>`${homeVisitRecord.createdAt}::text`,
          teacherName: headTeacher.name,
          className: homeroomClass.className,
        })
        .from(homeVisitRecord)
        .leftJoin(
          headTeacher,
          eq(homeVisitRecord.teacherId, headTeacher.id),
        )
        .leftJoin(
          homeroomClass,
          eq(homeVisitRecord.classId, homeroomClass.id),
        )
        .where(whereClause)
        .orderBy(desc(homeVisitRecord.visitDate))
        .limit(pageSize)
        .offset(offset);

      const items: HomeVisitRecord[] = records.map((r) => ({
        id: r.id,
        studentName: r.studentName,
        studentId: r.studentId ?? undefined,
        visitDate: r.visitDate,
        visitForm: r.visitForm as HomeVisitRecord['visitForm'],
        category: r.category as HomeVisitRecord['category'],
        summary: r.summary ?? undefined,
        remark: r.remark ?? undefined,
        teacherId: r.teacherId ?? undefined,
        teacherName: r.teacherName ?? undefined,
        classId: r.classId ?? undefined,
        className: r.className ?? undefined,
        grade: r.grade as Grade,
        createdAt: r.createdAt,
        month: r.visitDate.slice(0, 7),
      }));

      return {
        items,
        total,
        page,
        pageSize,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error(
        '获取家访记录列表失败',
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * 获取单条家访记录详情（含附件列表）
   */
   async getById(id: string, teacherId: string): Promise<HomeVisitRecord> {
     try {
      const role = await this.resolveRole(teacherId);

      const records = await this.db
        .select({
          id: homeVisitRecord.id,
          studentName: homeVisitRecord.studentName,
          studentId: homeVisitRecord.studentId,
          visitDate: homeVisitRecord.visitDate,
          visitForm: homeVisitRecord.visitForm,
          category: homeVisitRecord.category,
          summary: homeVisitRecord.summary,
          remark: homeVisitRecord.remark,
          teacherId: homeVisitRecord.teacherId,
          classId: homeVisitRecord.classId,
          grade: homeVisitRecord.grade,
          createdAt: sql<string>`${homeVisitRecord.createdAt}::text`,
          teacherName: headTeacher.name,
          className: homeroomClass.className,
        })
        .from(homeVisitRecord)
        .leftJoin(
          headTeacher,
          eq(homeVisitRecord.teacherId, headTeacher.id),
        )
        .leftJoin(
          homeroomClass,
          eq(homeVisitRecord.classId, homeroomClass.id),
        )
        .where(eq(homeVisitRecord.id, id));

      if (records.length === 0) {
        throw new NotFoundException('家访记录不存在');
      }

      const record = records[0];

      // 数据范围权限检查
       const { userGrade, userClassName } = await this.resolveUserScope(
         teacherId,
         role,
       );
       if (!checkRecordPermission(role, userGrade, userClassName, record.grade, record.className)) {
         throw new ForbiddenException('无操作权限');
       }

      // 查询附件
      const attachments = await this.db
        .select({
          id: homeVisitAttachment.id,
          recordId: homeVisitAttachment.recordId,
          fileName: homeVisitAttachment.fileName,
          fileSize: homeVisitAttachment.fileSize,
          bucketId: sql<string>`(${homeVisitAttachment.fileAttachment}).bucket_id`.as(
            'bucket_id',
          ),
          filePath: sql<string>`(${homeVisitAttachment.fileAttachment}).file_path`.as(
            'file_path',
          ),
        })
        .from(homeVisitAttachment)
        .where(eq(homeVisitAttachment.recordId, id))
        .orderBy(desc(homeVisitAttachment.createdAt));

       const attachmentList: HomeVisitAttachment[] = await Promise.all(
         attachments.map(async (a) => {
           let downloadUrl: string = a.filePath ?? '';
           if (a.filePath) {
             try {
               downloadUrl = await this.fileService.createSignedUrl(a.filePath, 3600);
             } catch {
               downloadUrl = a.filePath ?? '';
             }
           }
           return {
             id: a.id,
             recordId: a.recordId,
             fileName: a.fileName,
             fileSize: Number(a.fileSize),
             bucketId: a.bucketId,
             filePath: a.filePath,
             downloadUrl,
           };
         }),
       );

      return {
        id: record.id,
        studentName: record.studentName,
        studentId: record.studentId ?? undefined,
        visitDate: record.visitDate,
        visitForm: record.visitForm as HomeVisitRecord['visitForm'],
        category: record.category as HomeVisitRecord['category'],
        summary: record.summary ?? undefined,
        remark: record.remark ?? undefined,
        teacherId: record.teacherId ?? undefined,
        teacherName: record.teacherName ?? undefined,
        classId: record.classId ?? undefined,
        className: record.className ?? undefined,
        grade: record.grade as Grade,
        attachments: attachmentList,
        createdAt: record.createdAt,
        month: record.visitDate.slice(0, 7),
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      this.logger.error(
        `获取家访记录详情失败：${id}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * 根据 grade + className 查找或创建班级
   */
  private async getOrCreateClass(
    grade: string,
    className: string,
  ): Promise<{ id: string; grade: string; className: string }> {
    // 先尝试查找
    const existing = await this.db
      .select({
        id: homeroomClass.id,
        grade: homeroomClass.grade,
        className: homeroomClass.className,
      })
      .from(homeroomClass)
      .where(
        and(
          eq(homeroomClass.grade, grade),
          eq(homeroomClass.className, className),
        ),
      );

    if (existing.length > 0) {
      return {
        id: existing[0].id,
        grade: existing[0].grade,
        className: existing[0].className,
      };
    }

    // 不存在则插入，ON CONFLICT 处理并发
    const inserted = await this.db
      .insert(homeroomClass)
      .values({ grade, className })
      .onConflictDoNothing({
        target: [homeroomClass.grade, homeroomClass.className],
      })
      .returning({
        id: homeroomClass.id,
        grade: homeroomClass.grade,
        className: homeroomClass.className,
      });

    if (inserted.length > 0) {
      return {
        id: inserted[0].id,
        grade: inserted[0].grade,
        className: inserted[0].className,
      };
    }

    // 并发场景：另一请求已插入，再查一次
    const fallback = await this.db
      .select({
        id: homeroomClass.id,
        grade: homeroomClass.grade,
        className: homeroomClass.className,
      })
      .from(homeroomClass)
      .where(
        and(
          eq(homeroomClass.grade, grade),
          eq(homeroomClass.className, className),
        ),
      );

    if (fallback.length === 0) {
      throw new BadRequestException('班级创建失败');
    }

    return {
      id: fallback[0].id,
      grade: fallback[0].grade,
      className: fallback[0].className,
    };
  }

  /**
   * 新增家访记录
   */
  async create(
    dto: CreateRecordDto,
    teacherId: string,
  ): Promise<HomeVisitRecord> {
    try {
      const role = await this.resolveRole(teacherId);
       const { userGrade, userClassName } = await this.resolveUserScope(
         teacherId,
         role,
       );

       let recordTeacherId: string | undefined;
       let recordClassId: string | undefined;
       let recordGrade: string;
       let recordClassName: string;

       if (role === 'teacher') {
         // 班主任：使用自身的 grade/classId，忽略 dto 传入的值
         const teacher = await this.getCurrentTeacher(teacherId);
         recordTeacherId = teacher.id;
         recordClassId = teacher.classId;
         recordGrade = teacher.grade;
         recordClassName = teacher.className;
       } else if (role === 'grade_head' || role === 'grade_director') {
         // 级长/年级主任：只能在本年级创建，班级用 dto 传入的
         if (!dto.className) {
           throw new BadRequestException('班级为必填项');
         }
         if (dto.className.length > 50) {
           throw new BadRequestException('班级名称长度不能超过 50');
         }
         if (dto.grade && dto.grade !== userGrade) {
           throw new ForbiddenException('无操作权限');
         }
         const cls = await this.getOrCreateClass(userGrade!, dto.className);
         recordClassId = cls.id;
         recordGrade = cls.grade;
         recordClassName = cls.className;
         recordTeacherId = undefined;
       } else {
         // admin/school_leader：使用 dto 中传入的 grade 和 className
         if (!dto.grade) {
           throw new BadRequestException('年级为必填项');
         }
         if (!dto.className) {
           throw new BadRequestException('班级为必填项');
         }
         if (dto.className.length > 50) {
           throw new BadRequestException('班级名称长度不能超过 50');
         }
         const cls = await this.getOrCreateClass(dto.grade, dto.className);
         recordClassId = cls.id;
         recordGrade = cls.grade;
         recordClassName = cls.className;
         recordTeacherId = undefined;
       }

      const inserted = await this.db
        .insert(homeVisitRecord)
        .values({
          studentName: dto.studentName,
          studentId: dto.studentId,
          visitDate: dto.visitDate,
          visitForm: dto.visitForm,
          category: dto.category,
          summary: dto.summary,
          remark: dto.remark,
          teacherId: recordTeacherId,
          classId: recordClassId,
          grade: recordGrade,
        })
        .returning({ id: homeVisitRecord.id });

      if (inserted.length === 0) {
        throw new BadRequestException('创建记录失败');
      }

      const record = await this.getById(inserted[0].id, teacherId);
      this.logger.log(`创建家访记录成功：${inserted[0].id}`);
      return record;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      this.logger.error(
        '创建家访记录失败',
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * 编辑家访记录
   */
  async update(
    id: string,
    dto: UpdateRecordDto,
    teacherId: string,
  ): Promise<HomeVisitRecord> {
    try {
      const role = await this.resolveRole(teacherId);

       // 先查出记录验证权限
       const existing = await this.db
         .select({
           id: homeVisitRecord.id,
           grade: homeVisitRecord.grade,
           className: homeroomClass.className,
         })
         .from(homeVisitRecord)
         .leftJoin(
           homeroomClass,
           eq(homeVisitRecord.classId, homeroomClass.id),
         )
         .where(eq(homeVisitRecord.id, id));

       if (existing.length === 0) {
         throw new NotFoundException('家访记录不存在');
       }

       const { userGrade, userClassName } = await this.resolveUserScope(
         teacherId,
         role,
       );
       this.assertWritePermission(
         role,
         userGrade,
         userClassName,
         existing[0].grade,
         existing[0].className ?? undefined,
       );

      // 构建更新字段
      const patch: Record<string, unknown> = {};
      if (dto.studentName !== undefined) patch.studentName = dto.studentName;
      if (dto.studentId !== undefined) patch.studentId = dto.studentId;
      if (dto.visitDate !== undefined) patch.visitDate = dto.visitDate;
      if (dto.visitForm !== undefined) patch.visitForm = dto.visitForm;
      if (dto.category !== undefined) patch.category = dto.category;
      if (dto.summary !== undefined) patch.summary = dto.summary;
      if (dto.remark !== undefined) patch.remark = dto.remark;

      // admin/school_leader 角色允许修改 grade / className
      // grade_head/grade_director 允许修改 className 但不能改 grade（只能在本年级内）
      if (role === 'admin' || role === 'school_leader' || role === 'grade_head' || role === 'grade_director') {
        const gradeChanging = dto.grade !== undefined;
        const classNameChanging = dto.className !== undefined;

        // grade_head/grade_director 不能修改 grade
        if (gradeChanging && (role === 'grade_head' || role === 'grade_director')) {
          throw new ForbiddenException('无操作权限');
        }

        if (gradeChanging || classNameChanging) {
          // 需要当前 grade 或 className 来组合查询
          const current = await this.db
            .select({
              grade: homeVisitRecord.grade,
              classId: homeVisitRecord.classId,
            })
            .from(homeVisitRecord)
            .where(eq(homeVisitRecord.id, id));

          let newGrade: string = current[0]?.grade ?? '';
          let newClassName = '';

          if (classNameChanging) {
            newClassName = dto.className!;
          } else if (current[0]?.classId) {
            // className 未变，通过 classId 查当前 className
            const clsRow = await this.db
              .select({ className: homeroomClass.className })
              .from(homeroomClass)
              .where(eq(homeroomClass.id, current[0].classId!));
            newClassName = clsRow[0]?.className ?? '';
          }

          if (gradeChanging) {
            newGrade = dto.grade!;
          }

          if (newGrade && newClassName) {
            if (newClassName.length > 50) {
              throw new BadRequestException('班级名称长度不能超过 50');
            }
            const cls = await this.getOrCreateClass(newGrade, newClassName);
            patch.grade = cls.grade;
            patch.classId = cls.id;
          } else if (gradeChanging) {
            // 只改了 grade 但没有 className 可匹配（classId 为空也没传 className）
            patch.grade = dto.grade;
          }
        }
      }
      // teacher 角色：忽略 grade/className 修改

      if (Object.keys(patch).length === 0) {
        throw new BadRequestException('未提供可更新字段');
      }

      await this.db
        .update(homeVisitRecord)
        .set(patch)
        .where(eq(homeVisitRecord.id, id));

      const record = await this.getById(id, teacherId);
      this.logger.log(`更新家访记录成功：${id}`);
      return record;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      this.logger.error(
        `更新家访记录失败：${id}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * 删除家访记录
   */
   async remove(id: string, teacherId: string): Promise<void> {
     try {
      const role = await this.resolveRole(teacherId);

      // 先查出记录验证权限
      const existing = await this.db
        .select({
          id: homeVisitRecord.id,
          grade: homeVisitRecord.grade,
          className: homeroomClass.className,
        })
        .from(homeVisitRecord)
        .leftJoin(
          homeroomClass,
          eq(homeVisitRecord.classId, homeroomClass.id),
        )
        .where(eq(homeVisitRecord.id, id));

      if (existing.length === 0) {
        throw new NotFoundException('家访记录不存在');
      }

      const { userGrade, userClassName } = await this.resolveUserScope(
        teacherId,
        role,
      );
      this.assertWritePermission(
        role,
        userGrade,
        userClassName,
        existing[0].grade,
        existing[0].className ?? undefined,
      );

      await this.db
        .delete(homeVisitRecord)
        .where(eq(homeVisitRecord.id, id));

      this.logger.log(`删除家访记录成功：${id}`);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      this.logger.error(
        `删除家访记录失败：${id}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * 添加附件
   */
  async addAttachment(
    recordId: string,
    fileInfo: {
      fileName: string;
      fileSize: number;
      bucketId: string;
      filePath: string;
    },
    teacherId: string,
   ): Promise<HomeVisitAttachment> {
     try {
      const role = await this.resolveRole(teacherId);

      // 验证记录存在且有权限
      const existing = await this.db
        .select({
          id: homeVisitRecord.id,
          grade: homeVisitRecord.grade,
          className: homeroomClass.className,
        })
        .from(homeVisitRecord)
        .leftJoin(
          homeroomClass,
          eq(homeVisitRecord.classId, homeroomClass.id),
        )
        .where(eq(homeVisitRecord.id, recordId));

      if (existing.length === 0) {
        throw new NotFoundException('家访记录不存在');
      }

      const { userGrade, userClassName } = await this.resolveUserScope(
        teacherId,
        role,
      );
      this.assertWritePermission(
        role,
        userGrade,
        userClassName,
        existing[0].grade,
        existing[0].className ?? undefined,
      );

      const inserted = await this.db
        .insert(homeVisitAttachment)
        .values({
          recordId,
          fileName: fileInfo.fileName,
          fileSize: fileInfo.fileSize,
          fileAttachment: {
            bucket_id: fileInfo.bucketId,
            file_path: fileInfo.filePath,
          },
        })
        .returning({ id: homeVisitAttachment.id });

      if (inserted.length === 0) {
        throw new BadRequestException('添加附件失败');
      }

      const attachments = await this.db
        .select({
          id: homeVisitAttachment.id,
          recordId: homeVisitAttachment.recordId,
          fileName: homeVisitAttachment.fileName,
          fileSize: homeVisitAttachment.fileSize,
          bucketId: sql<string>`(${homeVisitAttachment.fileAttachment}).bucket_id`.as(
            'bucket_id',
          ),
          filePath: sql<string>`(${homeVisitAttachment.fileAttachment}).file_path`.as(
            'file_path',
          ),
        })
        .from(homeVisitAttachment)
        .where(eq(homeVisitAttachment.id, inserted[0].id));

      const a = attachments[0];
      this.logger.log(`添加附件成功：${a.id} (记录: ${recordId})`);

       let downloadUrl: string = a.filePath ?? '';
       if (a.filePath) {
         try {
           downloadUrl = await this.fileService.createSignedUrl(a.filePath, 3600);
         } catch {
           // fallback to filePath
         }
       }

       return {
         id: a.id,
         recordId: a.recordId,
         fileName: a.fileName,
         fileSize: Number(a.fileSize),
         bucketId: a.bucketId,
         filePath: a.filePath,
         downloadUrl,
       };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      this.logger.error(
        `添加附件失败：${recordId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * 删除附件
   */
   async removeAttachment(
     attachmentId: string,
     teacherId: string,
    ): Promise<void> {
      try {
        const role = await this.resolveRole(teacherId);

        // 查出附件及其所属记录
       const attachments = await this.db
         .select({
           id: homeVisitAttachment.id,
           recordId: homeVisitAttachment.recordId,
           grade: homeVisitRecord.grade,
           className: homeroomClass.className,
         })
         .from(homeVisitAttachment)
         .leftJoin(
           homeVisitRecord,
           eq(homeVisitAttachment.recordId, homeVisitRecord.id),
         )
         .leftJoin(
           homeroomClass,
           eq(homeVisitRecord.classId, homeroomClass.id),
         )
         .where(eq(homeVisitAttachment.id, attachmentId));

       if (attachments.length === 0) {
         throw new NotFoundException('附件不存在');
       }

       const { userGrade, userClassName } = await this.resolveUserScope(
         teacherId,
         role,
       );
       this.assertWritePermission(
         role,
         userGrade,
         userClassName,
         attachments[0].grade,
         attachments[0].className ?? undefined,
       );

      await this.db
        .delete(homeVisitAttachment)
        .where(eq(homeVisitAttachment.id, attachmentId));

      this.logger.log(`删除附件成功：${attachmentId}`);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      this.logger.error(
        `删除附件失败：${attachmentId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * 获取附件下载链接
   */
   async getDownloadUrl(
     attachmentId: string,
     teacherId: string,
    ): Promise<{ downloadUrl: string }> {
      try {
        const role = await this.resolveRole(teacherId);

       const attachments = await this.db
         .select({
           id: homeVisitAttachment.id,
           grade: homeVisitRecord.grade,
           className: homeroomClass.className,
           bucketId: sql<string>`(${homeVisitAttachment.fileAttachment}).bucket_id`.as(
             'bucket_id',
           ),
           filePath: sql<string>`(${homeVisitAttachment.fileAttachment}).file_path`.as(
             'file_path',
           ),
         })
         .from(homeVisitAttachment)
         .leftJoin(
           homeVisitRecord,
           eq(homeVisitAttachment.recordId, homeVisitRecord.id),
         )
         .leftJoin(
           homeroomClass,
           eq(homeVisitRecord.classId, homeroomClass.id),
         )
         .where(eq(homeVisitAttachment.id, attachmentId));

       if (attachments.length === 0) {
         throw new NotFoundException('附件不存在');
       }

       const { userGrade, userClassName } = await this.resolveUserScope(
         teacherId,
         role,
       );
       if (!checkRecordPermission(role, userGrade, userClassName, attachments[0].grade, attachments[0].className ?? undefined)) {
         throw new ForbiddenException('无操作权限');
       }

       const att = attachments[0];

       if (!att.filePath) {
         throw new BadRequestException('附件存储信息不完整');
       }

       const downloadUrl = await this.fileService.createSignedUrl(att.filePath, 3600);
       return { downloadUrl };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      this.logger.error(
        `获取附件下载链接失败：${attachmentId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * 导出家访记录为 CSV
   */
   async exportRecords(
     params: RecordListParams,
     teacherId: string,
   ): Promise<{ buffer: Buffer; filename: string }> {
     const role = await this.resolveRole(teacherId);
     const MAX_EXPORT = 5000;

     // 构建筛选条件（复用 list 的逻辑，不分页）
     const conditions = [];

     // 数据范围过滤
     const { userGrade, userClassName } = await this.resolveUserScope(
       teacherId,
       role,
     );
     const scope = getDataScope(role, userGrade, userClassName);
     if (!scope.isAll) {
       if (scope.grade) {
         conditions.push(eq(homeVisitRecord.grade, scope.grade));
       }
       if (scope.className) {
         const classIds = await this.db
           .select({ id: homeroomClass.id })
           .from(homeroomClass)
           .where(eq(homeroomClass.className, scope.className));
         if (classIds.length > 0) {
           conditions.push(
             inArray(
               homeVisitRecord.classId,
               classIds.map((c) => c.id),
             ),
           );
         } else {
           throw new BadRequestException('筛选结果为空，无法导出');
         }
       }
     }

     if (params.teacherId) {
       conditions.push(eq(homeVisitRecord.teacherId, params.teacherId));
     }

    if (params.studentName) {
      conditions.push(
        like(homeVisitRecord.studentName, `%${params.studentName}%`),
      );
    }
    if (params.grade) {
      conditions.push(eq(homeVisitRecord.grade, params.grade));
    }
    if (params.className) {
      const classIds = await this.db
        .select({ id: homeroomClass.id })
        .from(homeroomClass)
        .where(like(homeroomClass.className, `%${params.className}%`));
      if (classIds.length > 0) {
        conditions.push(
          inArray(
            homeVisitRecord.classId,
            classIds.map((c) => c.id),
          ),
        );
      } else {
        throw new BadRequestException('筛选结果为空，无法导出');
      }
    }
    if (params.visitForm) {
      conditions.push(eq(homeVisitRecord.visitForm, params.visitForm));
    }
    if (params.category) {
      conditions.push(eq(homeVisitRecord.category, params.category));
    }
    if (params.month) {
      const monthStart = `${params.month}-01`;
      const [year, month] = params.month.split('-').map(Number);
      const nextMonthDate = new Date(year, month, 1);
      const nextMonth = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-01`;
      conditions.push(gte(homeVisitRecord.visitDate, monthStart));
      conditions.push(lt(homeVisitRecord.visitDate, nextMonth));
    }
    if (params.startDate) {
      conditions.push(gte(homeVisitRecord.visitDate, params.startDate));
    }
    if (params.endDate) {
      conditions.push(lte(homeVisitRecord.visitDate, params.endDate));
    }

    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

    // 先查数量，超过限制报错
    const countResult = await this.db
      .select({ count: count() })
      .from(homeVisitRecord)
      .where(whereClause);
    const total = Number(countResult[0]?.count ?? 0);

    if (total === 0) {
      throw new BadRequestException('筛选结果为空，无法导出');
    }
    if (total > MAX_EXPORT) {
      throw new BadRequestException(
        `导出数量超过限制（最多 ${MAX_EXPORT} 条），请缩小筛选范围`,
      );
    }

    // 查询所有记录
    const records = await this.db
      .select({
        id: homeVisitRecord.id,
        studentName: homeVisitRecord.studentName,
        visitDate: homeVisitRecord.visitDate,
        visitForm: homeVisitRecord.visitForm,
        category: homeVisitRecord.category,
        summary: homeVisitRecord.summary,
        remark: homeVisitRecord.remark,
        grade: homeVisitRecord.grade,
        teacherName: headTeacher.name,
        className: homeroomClass.className,
      })
      .from(homeVisitRecord)
      .leftJoin(
        headTeacher,
        eq(homeVisitRecord.teacherId, headTeacher.id),
      )
      .leftJoin(
        homeroomClass,
        eq(homeVisitRecord.classId, homeroomClass.id),
      )
      .where(whereClause)
      .orderBy(desc(homeVisitRecord.visitDate))
      .limit(MAX_EXPORT);

    // 构建 CSV 内容
    const headers = [
      '年级',
      '班级',
      '学生姓名',
      '月份',
      '家访日期',
      '家访形式',
      '家访类别',
      '家访内容摘要',
      '备注',
      '上传人',
    ];

    const escapeCsv = (value: string): string => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const rows = records.map((r) => {
      const gradeLabel =
        GRADE_LABELS[(r.grade as Grade) ?? 'grade_1'] ?? r.grade;
      const formLabel =
        VISIT_FORM_LABELS[(r.visitForm as VisitForm) ?? 'on_site'] ??
        r.visitForm;
      const categoryLabel =
        VISIT_CATEGORY_LABELS[(r.category as VisitCategory) ?? 'regular'] ??
        r.category;
      return [
        gradeLabel,
        r.className ?? '',
        r.studentName,
        r.visitDate.slice(0, 7),
        r.visitDate,
        formLabel,
        categoryLabel,
        (r.summary ?? '').replace(/\r?\n/g, ' '),
        (r.remark ?? '').replace(/\r?\n/g, ' '),
        r.teacherName ?? '管理员',
      ]
        .map((cell: string) => escapeCsv(cell))
        .join(',');
    });

    const csvContent = `\uFEFF${headers.join(',')}\n${rows.join('\n')}`;
    const buffer = Buffer.from(csvContent, 'utf-8');

    // 生成文件名
    const filterParts: string[] = [];
    if (params.month) filterParts.push(params.month);
    if (params.grade) filterParts.push(GRADE_LABELS[params.grade]);
    if (params.className) filterParts.push(params.className);
    const filterStr = filterParts.length > 0 ? filterParts.join('_') : '全部';
    const today = new Date();
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const filename = `家访记录_${filterStr}_${dateStr}.csv`;

    return { buffer, filename };
  }

  /**
   * 批量下载家访记录附件为 zip
   */
  async batchDownload(
    recordIds: string[],
    teacherId: string,
  ): Promise<{ zipBuffer: Buffer; filename: string }> {
    if (!Array.isArray(recordIds) || recordIds.length === 0) {
      throw new BadRequestException('请选择要下载的记录');
    }

    const role = await this.resolveRole(teacherId);
    const MAX_FILES = 50;
    const MAX_TOTAL_SIZE = 100 * 1024 * 1024; // 100MB

    // 查询记录及附件
    const attachments = await this.db
      .select({
        id: homeVisitAttachment.id,
        recordId: homeVisitAttachment.recordId,
        fileName: homeVisitAttachment.fileName,
        fileSize: homeVisitAttachment.fileSize,
        bucketId: sql<string>`(${homeVisitAttachment.fileAttachment}).bucket_id`.as(
          'bucket_id',
        ),
        filePath: sql<string>`(${homeVisitAttachment.fileAttachment}).file_path`.as(
          'file_path',
        ),
        studentName: homeVisitRecord.studentName,
        grade: homeVisitRecord.grade,
        className: homeroomClass.className,
      })
      .from(homeVisitAttachment)
      .leftJoin(
        homeVisitRecord,
        eq(homeVisitAttachment.recordId, homeVisitRecord.id),
      )
      .leftJoin(
        homeroomClass,
        eq(homeVisitRecord.classId, homeroomClass.id),
      )
      .where(inArray(homeVisitAttachment.recordId, recordIds));

    if (attachments.length === 0) {
      throw new BadRequestException('选中的记录没有附件可供下载');
    }

    // 权限校验：按数据范围检查所有记录
    const { userGrade, userClassName } = await this.resolveUserScope(
      teacherId,
      role,
    );
    const hasUnauthorized = attachments.some(
      (a) => !checkRecordPermission(role, userGrade, userClassName, a.grade, a.className ?? undefined),
    );
    if (hasUnauthorized) {
      throw new ForbiddenException('无操作权限');
    }

    // 数量和大小限制
    if (attachments.length > MAX_FILES) {
      throw new BadRequestException(
        `单次最多下载 ${MAX_FILES} 个附件，请减少选择数量`,
      );
    }
    const totalSize = attachments.reduce(
      (sum: number, a) => sum + Number(a.fileSize || 0),
      0,
    );
    if (totalSize > MAX_TOTAL_SIZE) {
      throw new BadRequestException(
        `附件总大小超过限制（100MB），请减少选择数量`,
      );
    }

    // 按「学生姓名/文件名」组织路径，同名追加序号
    const nameCount = new Map<string, number>();
    const fileEntries: Array<{ path: string; filePath: string; fileName: string; bucketId: string }> = [];

    for (const att of attachments) {
      if (!att.bucketId || !att.filePath) continue;

      const studentName = att.studentName || '未知学生';
      const safeName = this.sanitizeFileName(studentName);
      const safeFile = this.sanitizeFileName(att.fileName || 'file');
      let zipPath = `${safeName}/${safeFile}`;

      const count = nameCount.get(zipPath) || 0;
      if (count > 0) {
        const dotIndex = safeFile.lastIndexOf('.');
        const base = dotIndex > 0 ? safeFile.slice(0, dotIndex) : safeFile;
        const ext = dotIndex > 0 ? safeFile.slice(dotIndex) : '';
        zipPath = `${safeName}/${base}(${count})${ext}`;
      }
      nameCount.set(zipPath, count + 1);

      fileEntries.push({
        path: zipPath,
        filePath: att.filePath,
        fileName: att.fileName,
        bucketId: att.bucketId,
      });
    }

    if (fileEntries.length === 0) {
      throw new BadRequestException('选中的记录没有有效附件可供下载');
    }

    // 下载所有文件并打包 zip
    const zipParts: Buffer[] = [];
    const centralDir: Buffer[] = [];
    let offset = 0;

    for (const entry of fileEntries) {
      try {
        const { content } = await this.fileService.download(entry.filePath);
        const arrayBuffer = await content.arrayBuffer();
        const fileBuffer = Buffer.from(arrayBuffer);

        const { localHeader, dataSize } = this.buildZipLocalEntry(
          entry.path,
          fileBuffer,
        );
        const { centralEntry } = this.buildZipCentralEntry(
          entry.path,
          fileBuffer,
          offset,
        );

        zipParts.push(localHeader);
        zipParts.push(fileBuffer);
        centralDir.push(centralEntry);
        offset += localHeader.length + dataSize;
      } catch (err) {
        this.logger.error(
          `批量下载：获取文件失败 ${entry.fileName}`,
          err instanceof Error ? err.stack : String(err),
        );
        throw new BadRequestException(`文件下载失败：${entry.fileName}`);
      }
    }

    const centralDirBuffer = Buffer.concat(centralDir);
    const endOfCentralDir = this.buildZipEndOfCentralDir(
      fileEntries.length,
      centralDirBuffer.length,
      offset,
    );

    const zipBuffer = Buffer.concat([...zipParts, centralDirBuffer, endOfCentralDir]);

    const today = new Date();
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const filename = `家访附件_${dateStr}.zip`;

    return { zipBuffer, filename };
  }

  /**
   * 清理文件名中的路径分隔符和非法字符
   */
  private sanitizeFileName(name: string): string {
    return name.replace(/[\\/:*?"<>|]/g, '_').replace(/\.\./g, '_').slice(0, 200);
  }

  /**
   * CRC32 计算（查表法）
   */
  private crc32Table: number[] | null = null;

  private getCrc32Table(): number[] {
    if (this.crc32Table) return this.crc32Table;
    const table: number[] = new Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[i] = c >>> 0;
    }
    this.crc32Table = table;
    return table;
  }

  private crc32(buf: Buffer): number {
    const table = this.getCrc32Table();
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  /**
   * 构建 ZIP 本地文件头（store 方式，无压缩）
   */
  private buildZipLocalEntry(
    filename: string,
    data: Buffer,
  ): { localHeader: Buffer; dataSize: number } {
    const nameBuf = Buffer.from(filename, 'utf-8');
    const crc = this.crc32(data);
    const size = data.length;

    const buf = Buffer.alloc(30 + nameBuf.length);
    // local file header signature
    buf.writeUInt32LE(0x04034b50, 0);
    // version needed to extract (2.0)
    buf.writeUInt16LE(20, 4);
    // general purpose bit flag (UTF-8)
    buf.writeUInt16LE(0x0800, 6);
    // compression method (0 = store)
    buf.writeUInt16LE(0, 8);
    // last mod file time + date (0 = placeholder)
    buf.writeUInt16LE(0, 10);
    buf.writeUInt16LE(0, 12);
    // crc-32
    buf.writeUInt32LE(crc, 14);
    // compressed size
    buf.writeUInt32LE(size, 18);
    // uncompressed size
    buf.writeUInt32LE(size, 22);
    // file name length
    buf.writeUInt16LE(nameBuf.length, 26);
    // extra field length
    buf.writeUInt16LE(0, 28);
    // file name
    nameBuf.copy(buf, 30);

    return { localHeader: buf, dataSize: size };
  }

  /**
   * 构建 ZIP 中央目录条目
   */
  private buildZipCentralEntry(
    filename: string,
    data: Buffer,
    offset: number,
  ): { centralEntry: Buffer } {
    const nameBuf = Buffer.from(filename, 'utf-8');
    const crc = this.crc32(data);
    const size = data.length;

    const buf = Buffer.alloc(46 + nameBuf.length);
    // central file header signature
    buf.writeUInt32LE(0x02014b50, 0);
    // version made by (2.0, MS-DOS)
    buf.writeUInt16LE(20, 4);
    // version needed to extract
    buf.writeUInt16LE(20, 6);
    // general purpose bit flag (UTF-8)
    buf.writeUInt16LE(0x0800, 8);
    // compression method
    buf.writeUInt16LE(0, 10);
    // last mod file time + date
    buf.writeUInt16LE(0, 12);
    buf.writeUInt16LE(0, 14);
    // crc-32
    buf.writeUInt32LE(crc, 16);
    // compressed size
    buf.writeUInt32LE(size, 20);
    // uncompressed size
    buf.writeUInt32LE(size, 24);
    // file name length
    buf.writeUInt16LE(nameBuf.length, 28);
    // extra field length
    buf.writeUInt16LE(0, 30);
    // file comment length
    buf.writeUInt16LE(0, 32);
    // disk number start
    buf.writeUInt16LE(0, 34);
    // internal file attributes
    buf.writeUInt16LE(0, 36);
    // external file attributes
    buf.writeUInt32LE(0, 38);
    // relative offset of local header
    buf.writeUInt32LE(offset, 42);
    // file name
    nameBuf.copy(buf, 46);

    return { centralEntry: buf };
  }

  /**
   * 构建 ZIP 中央目录结束标记
   */
  private buildZipEndOfCentralDir(
    entryCount: number,
    centralDirSize: number,
    centralDirOffset: number,
  ): Buffer {
    const buf = Buffer.alloc(22);
    // end of central dir signature
    buf.writeUInt32LE(0x06054b50, 0);
    // number of this disk
    buf.writeUInt16LE(0, 4);
    // number of the disk with the start of central directory
    buf.writeUInt16LE(0, 6);
    // total number of entries in the central directory on this disk
    buf.writeUInt16LE(entryCount, 8);
    // total number of entries in the central directory
    buf.writeUInt16LE(entryCount, 10);
    // size of the central directory
    buf.writeUInt32LE(centralDirSize, 12);
    // offset of start of central directory
    buf.writeUInt32LE(centralDirOffset, 16);
    // comment length
    buf.writeUInt16LE(0, 20);
    return buf;
  }
}
