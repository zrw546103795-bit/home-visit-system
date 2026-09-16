import type {
  CategoryStatsItem,
  FormStatsItem,
  Grade,
  GradeStatsItem,
  StatsOverview,
} from '@shared/api.interface';
import { apiRequest } from './index';

export async function getOverview(): Promise<StatsOverview> {
  return apiRequest<StatsOverview>({
    url: '/api/stats/overview',
    method: 'GET',
  });
}

export async function getGradeStats(
  month?: string,
): Promise<GradeStatsItem[]> {
  return apiRequest<GradeStatsItem[]>({
    url: '/api/stats/grade-stats',
    method: 'GET',
    params: month ? { month } : undefined,
  });
}

export async function getCategoryStats(params?: {
  month?: string;
  grade?: Grade;
}): Promise<CategoryStatsItem[]> {
  return apiRequest<CategoryStatsItem[]>({
    url: '/api/stats/category-stats',
    method: 'GET',
    params: params as Record<string, unknown> | undefined,
  });
}

export async function getFormStats(params?: {
  month?: string;
  grade?: Grade;
}): Promise<FormStatsItem[]> {
  return apiRequest<FormStatsItem[]>({
    url: '/api/stats/form-stats',
    method: 'GET',
    params: params as Record<string, unknown> | undefined,
  });
}

interface MonthlyTrendItem {
  month: string;
  count: number;
}

export async function getMonthlyTrend(): Promise<MonthlyTrendItem[]> {
  return apiRequest<MonthlyTrendItem[]>({
    url: '/api/stats/monthly-trend',
    method: 'GET',
  });
}
