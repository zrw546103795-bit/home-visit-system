import type {
  CreateTeacherDto,
  HeadTeacher,
  PaginatedResponse,
  TeacherListParams,
  UpdateTeacherDto,
} from '@shared/api.interface';
import { apiRequest } from './index';

export async function getTeacherList(
  params: TeacherListParams,
): Promise<PaginatedResponse<HeadTeacher>> {
  return apiRequest<PaginatedResponse<HeadTeacher>>({
    url: '/api/teachers',
    method: 'GET',
    params: params as unknown as Record<string, unknown>,
  });
}

export async function getTeacherById(id: string): Promise<HeadTeacher> {
  return apiRequest<HeadTeacher>({
    url: `/api/teachers/${id}`,
    method: 'GET',
  });
}

export async function createTeacher(
  data: CreateTeacherDto,
): Promise<HeadTeacher> {
  return apiRequest<HeadTeacher>({
    url: '/api/teachers',
    method: 'POST',
    data,
  });
}

export async function updateTeacher(
  id: string,
  data: UpdateTeacherDto,
): Promise<HeadTeacher> {
  return apiRequest<HeadTeacher>({
    url: `/api/teachers/${id}`,
    method: 'PATCH',
    data,
  });
}

export async function deleteTeacher(id: string): Promise<{ id: string }> {
  return apiRequest<{ id: string }>({
    url: `/api/teachers/${id}`,
    method: 'DELETE',
  });
}
