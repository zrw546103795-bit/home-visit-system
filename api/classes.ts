import type {
  Grade,
  HomeroomClass,
} from '@shared/api.interface';
import { apiRequest } from './index';

interface ClassGroupItem {
  grade: Grade;
  gradeLabel: string;
  classes: HomeroomClass[];
}

export async function getClassList(): Promise<ClassGroupItem[]> {
  return apiRequest<ClassGroupItem[]>({
    url: '/api/classes',
    method: 'GET',
  });
}

export async function getClassById(id: string): Promise<HomeroomClass> {
  return apiRequest<HomeroomClass>({
    url: `/api/classes/${id}`,
    method: 'GET',
  });
}

export async function createClass(data: {
  grade: Grade;
  className: string;
}): Promise<HomeroomClass> {
  return apiRequest<HomeroomClass>({
    url: '/api/classes',
    method: 'POST',
    data,
  });
}

export async function updateClass(
  id: string,
  data: Partial<{ grade: Grade; className: string }>,
): Promise<HomeroomClass> {
  return apiRequest<HomeroomClass>({
    url: `/api/classes/${id}`,
    method: 'PATCH',
    data,
  });
}

export async function deleteClass(id: string): Promise<{ id: string }> {
  return apiRequest<{ id: string }>({
    url: `/api/classes/${id}`,
    method: 'DELETE',
  });
}
