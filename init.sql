-- 家访材料管理系统 - 数据库初始化脚本
-- 适用于 PostgreSQL 12+

-- 创建表（如果不存在）
CREATE TABLE IF NOT EXISTS homeroom_class (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grade VARCHAR(20) NOT NULL,
  class_name VARCHAR(50) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(grade, class_name)
);

CREATE TABLE IF NOT EXISTS head_teacher (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(64),
  name VARCHAR(50) NOT NULL,
  account VARCHAR(50),
  password VARCHAR(255),
  grade VARCHAR(20) NOT NULL,
  class_name VARCHAR(50) NOT NULL,
  class_id UUID REFERENCES homeroom_class(id),
  role VARCHAR(20) NOT NULL DEFAULT 'teacher',
  user_name VARCHAR(50),
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS student (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL,
  grade VARCHAR(20) NOT NULL,
  class_name VARCHAR(50) NOT NULL,
  class_id UUID REFERENCES homeroom_class(id),
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS home_visit_record (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_name VARCHAR(50) NOT NULL,
  student_id UUID REFERENCES student(id),
  visit_date DATE NOT NULL,
  visit_form VARCHAR(20) NOT NULL,
  category VARCHAR(20) NOT NULL,
  summary TEXT,
  remark TEXT,
  teacher_id UUID REFERENCES head_teacher(id),
  class_id UUID REFERENCES homeroom_class(id),
  grade VARCHAR(20) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS home_visit_attachment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL REFERENCES home_visit_record(id) ON DELETE CASCADE,
  file_attachment JSONB,
  file_name VARCHAR(255) NOT NULL,
  file_size BIGINT DEFAULT 0,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS access_request (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_user_id VARCHAR(64) NOT NULL UNIQUE,
  platform_user_name VARCHAR(100) NOT NULL,
  name VARCHAR(50) NOT NULL,
  role VARCHAR(20) NOT NULL,
  grade VARCHAR(20),
  class_name VARCHAR(50),
  reason TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  reviewer_id VARCHAR(64),
  reviewed_at TIMESTAMP(6),
  reject_reason TEXT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_teacher_class ON head_teacher(class_id);
CREATE INDEX IF NOT EXISTS idx_teacher_account ON head_teacher(account);
CREATE INDEX IF NOT EXISTS idx_student_class ON student(class_id);
CREATE INDEX IF NOT EXISTS idx_student_grade_class ON student(grade, class_name);
CREATE INDEX IF NOT EXISTS idx_record_teacher ON home_visit_record(teacher_id);
CREATE INDEX IF NOT EXISTS idx_record_class ON home_visit_record(class_id);
CREATE INDEX IF NOT EXISTS idx_record_grade ON home_visit_record(grade);
CREATE INDEX IF NOT EXISTS idx_record_date ON home_visit_record(visit_date);
CREATE INDEX IF NOT EXISTS idx_record_form ON home_visit_record(visit_form);
CREATE INDEX IF NOT EXISTS idx_record_category ON home_visit_record(category);
CREATE INDEX IF NOT EXISTS idx_attach_record ON home_visit_attachment(record_id);
CREATE INDEX IF NOT EXISTS idx_access_request_status ON access_request(status);
CREATE INDEX IF NOT EXISTS idx_access_request_created ON access_request(created_at);

-- 插入默认管理员账号
INSERT INTO head_teacher (name, account, password, grade, class_name, role)
SELECT '系统管理员', 'admin', 'admin123', 'grade_1', '1班', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM head_teacher WHERE account = 'admin');

-- 插入示例班级
INSERT INTO homeroom_class (grade, class_name)
SELECT 'grade_1', '1班' WHERE NOT EXISTS (SELECT 1 FROM homeroom_class WHERE grade = 'grade_1' AND class_name = '1班');
INSERT INTO homeroom_class (grade, class_name)
SELECT 'grade_1', '2班' WHERE NOT EXISTS (SELECT 1 FROM homeroom_class WHERE grade = 'grade_1' AND class_name = '2班');
INSERT INTO homeroom_class (grade, class_name)
SELECT 'grade_2', '1班' WHERE NOT EXISTS (SELECT 1 FROM homeroom_class WHERE grade = 'grade_2' AND class_name = '1班');
INSERT INTO homeroom_class (grade, class_name)
SELECT 'grade_2', '2班' WHERE NOT EXISTS (SELECT 1 FROM homeroom_class WHERE grade = 'grade_2' AND class_name = '2班');
INSERT INTO homeroom_class (grade, class_name)
SELECT 'grade_3', '1班' WHERE NOT EXISTS (SELECT 1 FROM homeroom_class WHERE grade = 'grade_3' AND class_name = '1班');
INSERT INTO homeroom_class (grade, class_name)
SELECT 'grade_3', '2班' WHERE NOT EXISTS (SELECT 1 FROM homeroom_class WHERE grade = 'grade_3' AND class_name = '2班');
