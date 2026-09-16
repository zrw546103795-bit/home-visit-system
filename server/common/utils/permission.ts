import type { UserRole, Grade } from '@shared/api.interface';

export interface DataScope {
  isAll: boolean;
  grade?: Grade;
  className?: string;
}

/**
 * 根据角色获取数据范围
 * - admin/school_leader: 全部数据
 * - grade_head/grade_director: 本年级数据
 * - teacher: 本班数据
 */
export function getDataScope(
  role: UserRole,
  userGrade?: Grade,
  userClassName?: string,
): DataScope {
  if (role === 'admin' || role === 'school_leader') {
    return { isAll: true };
  }
  if (role === 'grade_head' || role === 'grade_director') {
    return { isAll: false, grade: userGrade };
  }
  // teacher
  return { isAll: false, grade: userGrade, className: userClassName };
}

/**
 * 校验写操作权限
 * - admin/school_leader: 可以操作任何记录
 * - grade_head/grade_director: 只能操作本年级的记录
 * - teacher: 只能操作本班的记录
 * 返回 true 表示有权限，false 表示无权限
 */
export function checkRecordPermission(
  role: UserRole,
  userGrade: Grade | undefined,
  userClassName: string | undefined,
  recordGrade: string,
  recordClassName: string | undefined,
): boolean {
  if (role === 'admin' || role === 'school_leader') {
    return true;
  }
  if (role === 'grade_head' || role === 'grade_director') {
    return recordGrade === userGrade;
  }
  // teacher
  return recordGrade === userGrade && recordClassName === userClassName;
}
