import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { TeacherService } from './teacher.service';
import type {
  HeadTeacher,
  PaginatedResponse,
  TeacherListParams,
  CreateTeacherDto,
  UpdateTeacherDto,
} from '@shared/api.interface';

@Controller('api/teachers')
export class TeacherController {
  constructor(private readonly teacherService: TeacherService) {}

  @Get()
  async list(
    @Req() req: Request,
    @Query('page') page: string,
    @Query('pageSize') pageSize: string,
    @Query('name') name?: string,
    @Query('grade') grade?: string,
  ): Promise<PaginatedResponse<HeadTeacher>> {
    const teacherId = req.headers['x-teacher-id'] as string;
    if (!teacherId) {
      throw new UnauthorizedException('未登录');
    }
    await this.teacherService.requireAdmin(teacherId);
    const params: TeacherListParams = {
      page: parseInt(page, 10) || 1,
      pageSize: parseInt(pageSize, 10) || 10,
      name,
      grade: grade as TeacherListParams['grade'],
    };
    return this.teacherService.list(params);
  }

  @Get(':id')
  async getById(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<HeadTeacher> {
    const teacherId = req.headers['x-teacher-id'] as string;
    if (!teacherId) {
      throw new UnauthorizedException('未登录');
    }
    await this.teacherService.requireAdmin(teacherId);
    return this.teacherService.getById(id);
  }

  @Post()
  async create(
    @Req() req: Request,
    @Body() dto: CreateTeacherDto,
  ): Promise<HeadTeacher> {
    const teacherId = req.headers['x-teacher-id'] as string;
    if (!teacherId) {
      throw new UnauthorizedException('未登录');
    }
    await this.teacherService.requireAdmin(teacherId);
    return this.teacherService.create(dto);
  }

  @Patch(':id')
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateTeacherDto,
  ): Promise<HeadTeacher> {
    const teacherId = req.headers['x-teacher-id'] as string;
    if (!teacherId) {
      throw new UnauthorizedException('未登录');
    }
    await this.teacherService.requireAdmin(teacherId);
    return this.teacherService.update(id, dto);
  }

  @Delete(':id')
  async remove(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<{ id: string }> {
    const teacherId = req.headers['x-teacher-id'] as string;
    if (!teacherId) {
      throw new UnauthorizedException('未登录');
    }
    await this.teacherService.requireAdmin(teacherId);
    await this.teacherService.remove(id);
    return { id };
  }
}
