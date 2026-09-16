import { useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import * as authApi from '@client/src/api/auth';
import type { CurrentUser, LoginDto, RegisterDto, UserRole } from '@shared/api.interface';

const STORAGE_KEY = 'home_visit_current_user';

function getStoredUser(): CurrentUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as CurrentUser;
    }
  } catch (error) {
    console.warn('读取本地用户信息失败', error);
  }
  return null;
}

function setStoredUser(user: CurrentUser | null): void {
  try {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (error) {
    console.warn('存储用户信息失败', error);
  }
}

export function getDashboardPath(_role: UserRole): string {
  return '/dashboard';
}

export function isNotBoundError(_error: unknown): boolean {
  return false;
}

interface UseCurrentUserReturn {
  user: CurrentUser | null;
  isLoading: boolean;
  isCheckingPlatform: boolean;
  login: (dto: LoginDto) => Promise<CurrentUser>;
  register: (dto: RegisterDto) => Promise<CurrentUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export function useCurrentUser(): UseCurrentUserReturn {
  const [user, setUser] = useState<CurrentUser | null>(getStoredUser());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const navigate = useNavigate();
  const location = useLocation();

  const login = useCallback(
    async (dto: LoginDto): Promise<CurrentUser> => {
      setIsLoading(true);
      try {
        const response = await authApi.login(dto);
        setUser(response.user);
        setStoredUser(response.user);
        console.info(`用户登录成功: ${response.user.name}`);
        return response.user;
      } catch (error) {
        console.error('登录失败', error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const register = useCallback(
    async (dto: RegisterDto): Promise<CurrentUser> => {
      setIsLoading(true);
      try {
        const response = await authApi.register(dto);
        if (response.user) {
          setUser(response.user);
          setStoredUser(response.user);
          console.info(`注册并登录成功: ${response.user.name}`);
          return response.user;
        }
        throw new Error('注册失败');
      } catch (error) {
        console.error('注册失败', error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const logout = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      await authApi.logout();
    } catch (error) {
      console.warn('登出接口调用失败，清除本地状态', error);
    } finally {
      setUser(null);
      setStoredUser(null);
      setIsLoading(false);
      const from = location.pathname;
      if (from && from !== '/login') {
        navigate('/login', { state: { from } });
      } else {
        navigate('/login');
      }
    }
  }, [navigate, location.pathname]);

  const refreshUser = useCallback(async (): Promise<void> => {
    try {
      const current = await authApi.getCurrentUser();
      setUser(current);
      setStoredUser(current);
    } catch (error) {
      console.error('刷新用户信息失败', error);
      setUser(null);
      setStoredUser(null);
      throw error;
    }
  }, []);

  return { user, isLoading, isCheckingPlatform: false, login, register, logout, refreshUser };
}
