import axios from 'axios';
import type { CurrentUser } from '@shared/api.interface';

export * as auth from './auth';
export * as classes from './classes';
export * as teachers from './teachers';
export * as students from './students';
export * as homeVisit from './home-visit';
export * as stats from './stats';
export * as importApi from './import';

const STORAGE_KEY = 'home_visit_current_user';

// 创建 axios 实例
const http = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

function getStoredUser(): CurrentUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as CurrentUser;
    }
  } catch {
    // 忽略解析错误
  }
  return null;
}

function clearStoredUser(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 忽略
  }
}

function getTeacherIdHeader(): Record<string, string> {
  const user = getStoredUser();
  if (user?.teacherId) {
    return { 'x-teacher-id': user.teacherId };
  }
  return {};
}

function handleUnauthorized(): void {
  clearStoredUser();
  if (typeof window !== 'undefined') {
    const event = new CustomEvent('auth:unauthorized', {
      detail: { from: window.location.pathname + window.location.search },
    });
    window.dispatchEvent(event);
  }
}

export async function apiRequest<T>(config: {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  data?: unknown;
  params?: Record<string, unknown>;
}): Promise<T> {
  try {
    const headers = {
      ...getTeacherIdHeader(),
    };
    const response = await http({
      url: config.url,
      method: config.method,
      data: config.data,
      params: config.params,
      headers,
    });
    if (response.status === 403) {
      throw new Error('无操作权限，请联系管理员分配角色');
    }
    return response.data as T;
  } catch (error) {
    const err = error as { response?: { status?: number } };
    if (err.response?.status === 401) {
      handleUnauthorized();
    }
    console.error(`API请求失败 ${config.method} ${config.url}`, error);
    throw error;
  }
}
