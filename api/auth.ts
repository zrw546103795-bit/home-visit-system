import { apiRequest } from './index';
import type {
  LoginDto,
  LoginResponse,
  CurrentUser,
  RegisterDto,
  BindAccountDto,
  BindAccountResponse,
} from '@shared/api.interface';

const AUTH_PREFIX = '/api/auth';

export function login(dto: LoginDto): Promise<LoginResponse> {
  return apiRequest<LoginResponse>({
    url: `${AUTH_PREFIX}/login`,
    method: 'POST',
    data: dto,
  });
}

export function logout(): Promise<void> {
  return apiRequest<void>({
    url: `${AUTH_PREFIX}/logout`,
    method: 'POST',
  });
}

export function getCurrentUser(): Promise<CurrentUser> {
  return apiRequest<CurrentUser>({
    url: `${AUTH_PREFIX}/me`,
    method: 'GET',
  });
}

export function register(dto: RegisterDto): Promise<{ success: boolean; message: string; user?: CurrentUser }> {
  return apiRequest<{ success: boolean; message: string; user?: CurrentUser }>({
    url: `${AUTH_PREFIX}/register`,
    method: 'POST',
    data: dto,
  });
}

export function bindAccount(dto: BindAccountDto): Promise<BindAccountResponse> {
  return apiRequest<BindAccountResponse>({
    url: `${AUTH_PREFIX}/bind`,
    method: 'POST',
    data: dto,
  });
}
