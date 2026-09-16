import { Controller, Get, Query, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { StatsService } from './stats.service';
import type {
  StatsOverview,
  GradeStatsItem,
  CategoryStatsItem,
  FormStatsItem,
} from '@shared/api.interface';

@Controller('api/stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('overview')
  async getOverview(@Req() req: Request): Promise<StatsOverview> {
    const teacherId = req.headers['x-teacher-id'] as string;
    if (!teacherId) {
      throw new UnauthorizedException('未登录');
    }
    const { role, userGrade, userClassName } =
      await this.statsService.resolveUserInfo(teacherId);
    return this.statsService.getOverview(role, userGrade, userClassName);
  }

  @Get('grade-stats')
  async getGradeStats(
    @Req() req: Request,
    @Query('month') month?: string,
  ): Promise<GradeStatsItem[]> {
    const teacherId = req.headers['x-teacher-id'] as string;
    if (!teacherId) {
      throw new UnauthorizedException('未登录');
    }
    const { role, userGrade, userClassName } =
      await this.statsService.resolveUserInfo(teacherId);
    return this.statsService.getGradeStats(month, role, userGrade, userClassName);
  }

  @Get('category-stats')
  async getCategoryStats(
    @Req() req: Request,
    @Query('month') month?: string,
    @Query('grade') grade?: string,
  ): Promise<CategoryStatsItem[]> {
    const teacherId = req.headers['x-teacher-id'] as string;
    if (!teacherId) {
      throw new UnauthorizedException('未登录');
    }
    const { role, userGrade, userClassName } =
      await this.statsService.resolveUserInfo(teacherId);
    return this.statsService.getCategoryStats(month, grade, role, userGrade, userClassName);
  }

  @Get('form-stats')
  async getFormStats(
    @Req() req: Request,
    @Query('month') month?: string,
    @Query('grade') grade?: string,
  ): Promise<FormStatsItem[]> {
    const teacherId = req.headers['x-teacher-id'] as string;
    if (!teacherId) {
      throw new UnauthorizedException('未登录');
    }
    const { role, userGrade, userClassName } =
      await this.statsService.resolveUserInfo(teacherId);
    return this.statsService.getFormStats(month, grade, role, userGrade, userClassName);
  }

  @Get('monthly-trend')
  async getMonthlyTrend(
    @Req() req: Request,
  ): Promise<{ month: string; count: number }[]> {
    const teacherId = req.headers['x-teacher-id'] as string;
    if (!teacherId) {
      throw new UnauthorizedException('未登录');
    }
    const { role, userGrade, userClassName } =
      await this.statsService.resolveUserInfo(teacherId);
    return this.statsService.getMonthlyTrend(role, userGrade, userClassName);
  }
}
