import { sql } from 'drizzle-orm';
import { bigint, date, foreignKey, index, pgTable, text, uniqueIndex, uuid, varchar, timestamp, jsonb } from "drizzle-orm/pg-core";

export interface FileAttachment {
  bucket_id: string;
  file_path: string;
}

// ========== 表定义 ==========

export const accessRequest = pgTable("access_request", {
  id: uuid("id").primaryKey().defaultRandom(),
  platformUserId: varchar("platform_user_id", { length: 64 }).notNull().unique(),
  platformUserName: varchar("platform_user_name", { length: 100 }).notNull(),
  name: varchar("name", { length: 50 }).notNull(),
  role: varchar("role", { length: 20 }).notNull(),
  grade: varchar("grade", { length: 20 }),
  className: varchar("class_name", { length: 50 }),
  reason: text("reason"),
  status: varchar("status", { length: 20 }).notNull().default('pending'),
  reviewerId: varchar("reviewer_id", { length: 64 }),
  reviewedAt: timestamp("reviewed_at", { precision: 6 }),
  rejectReason: text("reject_reason"),
  createdAt: timestamp("created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_access_request_user_pending").on(table.platformUserId),
  index("idx_access_request_status").on(table.status),
  index("idx_access_request_created").on(table.createdAt),
]);

export const homeVisitAttachment = pgTable("home_visit_attachment", {
  id: uuid("id").primaryKey().defaultRandom(),
  recordId: uuid("record_id").notNull(),
  fileAttachment: jsonb("file_attachment").$type<FileAttachment>(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileSize: bigint("file_size", { mode: 'number' }).default(0),
  createdAt: timestamp("created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_attach_record").on(table.recordId),
  foreignKey({
    columns: [table.recordId],
    foreignColumns: [homeVisitRecord.id],
    name: "home_visit_attachment_record_id_fkey",
  }).onDelete("cascade"),
]);

export const homeVisitRecord = pgTable("home_visit_record", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentName: varchar("student_name", { length: 50 }).notNull(),
  studentId: uuid("student_id"),
  visitDate: date("visit_date").notNull(),
  visitForm: varchar("visit_form", { length: 20 }).notNull(),
  category: varchar("category", { length: 20 }).notNull(),
  summary: text("summary"),
  remark: text("remark"),
  teacherId: uuid("teacher_id"),
  classId: uuid("class_id"),
  grade: varchar("grade", { length: 20 }).notNull(),
  createdAt: timestamp("created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_record_teacher").on(table.teacherId),
  index("idx_record_class").on(table.classId),
  index("idx_record_grade").on(table.grade),
  index("idx_record_date").on(table.visitDate),
  index("idx_record_form").on(table.visitForm),
  index("idx_record_category").on(table.category),
  foreignKey({
    columns: [table.studentId],
    foreignColumns: [student.id],
    name: "home_visit_record_student_id_fkey",
  }),
  foreignKey({
    columns: [table.teacherId],
    foreignColumns: [headTeacher.id],
    name: "home_visit_record_teacher_id_fkey",
  }),
  foreignKey({
    columns: [table.classId],
    foreignColumns: [homeroomClass.id],
    name: "home_visit_record_class_id_fkey",
  }),
]);

export const student = pgTable("student", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 50 }).notNull(),
  grade: varchar("grade", { length: 20 }).notNull(),
  className: varchar("class_name", { length: 50 }).notNull(),
  classId: uuid("class_id"),
  createdAt: timestamp("created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_student_class").on(table.classId),
  index("idx_student_grade_class").on(table.grade, table.className),
  foreignKey({
    columns: [table.classId],
    foreignColumns: [homeroomClass.id],
    name: "student_class_id_fkey",
  }),
]);

export const headTeacher = pgTable("head_teacher", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 64 }),
  name: varchar("name", { length: 50 }).notNull(),
  account: varchar("account", { length: 50 }),
  password: varchar("password", { length: 255 }),
  grade: varchar("grade", { length: 20 }).notNull(),
  className: varchar("class_name", { length: 50 }).notNull(),
  classId: uuid("class_id"),
  role: varchar("role", { length: 20 }).notNull().default('teacher'),
  userName: varchar("user_name", { length: 50 }),
  createdAt: timestamp("created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_teacher_class").on(table.classId),
  index("idx_teacher_account").on(table.account),
  foreignKey({
    columns: [table.classId],
    foreignColumns: [homeroomClass.id],
    name: "head_teacher_class_id_fkey",
  }),
]);

export const homeroomClass = pgTable("homeroom_class", {
  id: uuid("id").primaryKey().defaultRandom(),
  grade: varchar("grade", { length: 20 }).notNull(),
  className: varchar("class_name", { length: 50 }).notNull(),
  createdAt: timestamp("created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("homeroom_class_grade_class_name_key").on(table.grade, table.className),
]);

// table aliases
export const accessRequestTable = accessRequest;
export const headTeacherTable = headTeacher;
export const homeVisitAttachmentTable = homeVisitAttachment;
export const homeVisitRecordTable = homeVisitRecord;
export const homeroomClassTable = homeroomClass;
export const studentTable = student;
