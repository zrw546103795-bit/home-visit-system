import type {
  CreateStudentDto,
  PaginatedResponse,
  Student,
  StudentListParams,
} from '@shared/api.interface';
import { apiRequest } from './index';

export async function getStudentList(
  params: StudentListParams,
): Promise<PaginatedResponse<Student>> {
  return apiRequest<PaginatedResponse<Student>>({
    url: '/api/students',
    method: 'GET',
    params: params as unknown as Record<string, unknown>,
  });
}

export async function getStudentById(id: string): Promise<Student> {
  return apiRequest<Student>({
    url: `/api/students/${id}`,
    method: 'GET',
  });
}

export async function createStudent(
  data: CreateStudentDto,
): Promise<Student> {
  return apiRequest<Student>({
    url: '/api/students',
    method: 'POST',
    data,
  });
}

export async function updateStudent(
  id: string,
  data: Partial<CreateStudentDto>,
): Promise<Student> {
  return apiRequest<Student>({
    url: `/api/students/${id}`,
    method: 'PATCH',
    data,
  });
}

export async function deleteStudent(id: string): Promise<{ id: string }> {
  return apiRequest<{ id: string }>({
    url: `/api/students/${id}`,
    method: 'DELETE',
  });
}

export async function getStudentsByClass(classId: string): Promise<Student[]> {
  return apiRequest<Student[]>({
    url: `/api/students/by-class/${classId}`,
    method: 'GET',
  });
}
