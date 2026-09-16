export type Grade = 'grade_1' | 'grade_2' | 'grade_3';
export type VisitForm = 'on_site' | 'school' | 'phone' | 'wechat';
export type VisitCategory = 'regular' | 'key_care' | 'other';
export type UserRole = 'admin' | 'school_leader' | 'grade_head' | 'grade_director' | 'teacher';

export const GRADE_LABELS: Record<Grade, string> = {
  grade_1: '初一',
  grade_2: '初二',
  grade_3: '初三',
};

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: '管理员',
  school_leader: '校级领导',
  grade_head: '级长',
  grade_director: '年级主任',
  teacher: '班主任',
};

export const VISIT_FORM_LABELS: Record<VisitForm, string> = {
  on_site: '实地家访',
  school: '到校家访',
  phone: '电话家访',
  wechat: '微信家访',
};

export const VISIT_CATEGORY_LABELS: Record<VisitCategory, string> = {
  regular: '常规家访材料',
  key_care: '重点关爱学生家访材料',
  other: '其他家访材料',
};

export interface HomeroomClass {
  id: string;
  grade: Grade;
  className: string;
  createdAt: string;
}

export interface HeadTeacher {
  id: string;
  userId?: string;
  name: string;
  account?: string;
  grade: Grade;
  className: string;
  classId?: string;
  role: UserRole;
  createdAt: string;
}

export interface Student {
  id: string;
  name: string;
  grade: Grade;
  className: string;
  classId?: string;
  createdAt: string;
}

export interface HomeVisitAttachment {
  id: string;
  recordId: string;
  fileName: string;
  fileSize: number;
  bucketId?: string;
  filePath?: string;
  downloadUrl?: string;
}

export interface HomeVisitRecord {
  id: string;
  studentName: string;
  studentId?: string;
  visitDate: string;
  visitForm: VisitForm;
  category: VisitCategory;
  summary?: string;
  remark?: string;
  teacherId?: string;
  teacherName?: string;
  classId?: string;
  className?: string;
  grade: Grade;
  attachments?: HomeVisitAttachment[];
  createdAt: string;
  month: string;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface RecordListParams extends PaginationParams {
  studentName?: string;
  grade?: Grade;
  className?: string;
  visitForm?: VisitForm;
  category?: VisitCategory;
  month?: string;
  startDate?: string;
  endDate?: string;
  teacherId?: string;
}

export interface CreateRecordDto {
  studentName: string;
  studentId?: string;
  visitDate: string;
  visitForm: VisitForm;
  category: VisitCategory;
  summary?: string;
  remark?: string;
  grade: Grade;
  className: string;
}

export interface UpdateRecordDto {
  studentName?: string;
  studentId?: string;
  visitDate?: string;
  visitForm?: VisitForm;
  category?: VisitCategory;
  summary?: string;
  remark?: string;
  grade?: Grade;
  className?: string;
}

export interface TeacherListParams extends PaginationParams {
  name?: string;
  grade?: Grade;
}

export interface CreateTeacherDto {
  name: string;
  account: string;
  password: string;
  grade: Grade;
  className: string;
  role?: UserRole;
}

export interface UpdateTeacherDto {
  name?: string;
  grade?: Grade;
  className?: string;
  password?: string;
  role?: UserRole;
}

export interface StudentListParams extends PaginationParams {
  name?: string;
  grade?: Grade;
  className?: string;
}

export interface CreateStudentDto {
  name: string;
  grade: Grade;
  className: string;
}

export interface ImportResult {
  total: number;
  success: number;
  failed: number;
  errors: string[];
}

export interface MonthlyStats {
  month: string;
  gradeStats: Record<Grade, number>;
  categoryStats: Record<VisitCategory, number>;
  formStats: Record<VisitForm, number>;
  total: number;
}

export interface StatsOverview {
  totalRecords: number;
  totalTeachers: number;
  totalStudents: number;
  totalClasses: number;
  thisMonthRecords: number;
}

export interface GradeStatsItem {
  grade: Grade;
  gradeLabel: string;
  count: number;
}

export interface CategoryStatsItem {
  category: VisitCategory;
  categoryLabel: string;
  count: number;
}

export interface FormStatsItem {
  form: VisitForm;
  formLabel: string;
  count: number;
}

export interface CurrentUser {
  userId: string;
  name: string;
  role: UserRole;
  teacherId?: string;
  grade?: Grade;
  className?: string;
  classId?: string;
}

export interface LoginResponse {
  user: CurrentUser;
  token: string;
}

export interface BatchDownloadDto {
  recordIds: string[];
}

export interface LoginDto {
  account: string;
  password: string;
}

export interface RegisterDto {
  account: string;
  password: string;
  confirmPassword: string;
  name: string;
  role: UserRole;
  grade?: Grade;
  className?: string;
}

export interface BindAccountDto {
  account: string;
  password: string;
}

export interface BindAccountResponse {
  user: CurrentUser;
  message: string;
}

export type AccessRequestStatus = 'pending' | 'approved' | 'rejected';

export interface AccessRequest {
  id: string;
  platformUserId: string;
  platformUserName: string;
  name: string;
  role: UserRole;
  grade?: Grade;
  className?: string;
  reason?: string;
  status: AccessRequestStatus;
  reviewerId?: string;
  reviewedAt?: string;
  rejectReason?: string;
  createdAt: string;
}

export interface CreateAccessRequestDto {
  name: string;
  role: UserRole;
  grade?: Grade;
  className?: string;
  reason?: string;
}

export interface AccessRequestListParams extends PaginationParams {
  status?: AccessRequestStatus;
}

export interface ReviewAccessRequestDto {
  action: 'approve' | 'reject';
  rejectReason?: string;
}

export interface MyAccessRequestResponse {
  request: AccessRequest | null;
}
