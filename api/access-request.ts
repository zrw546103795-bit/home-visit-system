import { apiRequest } from './index';
import type {
  AccessRequest,
  CreateAccessRequestDto,
  AccessRequestListParams,
  ReviewAccessRequestDto,
  PaginatedResponse,
  CurrentUser,
  MyAccessRequestResponse,
} from '@shared/api.interface';

const PREFIX = '/api/access-request';

export function submitRequest(dto: CreateAccessRequestDto): Promise<{ request: AccessRequest }> {
  return apiRequest<{ request: AccessRequest }>({
    url: `${PREFIX}`,
    method: 'POST',
    data: dto,
  });
}

export function getMyRequest(): Promise<MyAccessRequestResponse> {
  return apiRequest<MyAccessRequestResponse>({
    url: `${PREFIX}/mine`,
    method: 'GET',
  });
}

export function listRequests(
  params: AccessRequestListParams,
): Promise<PaginatedResponse<AccessRequest>> {
  return apiRequest<PaginatedResponse<AccessRequest>>({
    url: `${PREFIX}`,
    method: 'GET',
    params: params as unknown as Record<string, unknown>,
  });
}

export function getPendingCount(): Promise<{ count: number }> {
  return apiRequest<{ count: number }>({
    url: `${PREFIX}/pending-count`,
    method: 'GET',
  });
}

export function reviewRequest(
  id: string,
  dto: ReviewAccessRequestDto,
): Promise<{ success: boolean; message: string; user?: CurrentUser }> {
  return apiRequest<{ success: boolean; message: string; user?: CurrentUser }>({
    url: `${PREFIX}/${id}/review`,
    method: 'POST',
    data: dto,
  });
}
