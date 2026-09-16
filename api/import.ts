import type {
  CreateStudentDto,
  CreateTeacherDto,
  ImportResult,
} from '@shared/api.interface';
import { apiRequest } from './index';

interface TemplateField {
  key: string;
  label: string;
  required: boolean;
}

export async function importTeachers(
  data: CreateTeacherDto[],
): Promise<ImportResult> {
  return apiRequest<ImportResult>({
    url: '/api/import/teachers',
    method: 'POST',
    data,
  });
}

export async function importStudents(
  data: CreateStudentDto[],
): Promise<ImportResult> {
  return apiRequest<ImportResult>({
    url: '/api/import/students',
    method: 'POST',
    data,
  });
}

export async function getTeacherTemplate(): Promise<{ fields: TemplateField[] }> {
  return apiRequest<{ fields: TemplateField[] }>({
    url: '/api/import/template/teachers',
    method: 'GET',
  });
}

export async function getStudentTemplate(): Promise<{ fields: TemplateField[] }> {
  return apiRequest<{ fields: TemplateField[] }>({
    url: '/api/import/template/students',
    method: 'GET',
  });
}
