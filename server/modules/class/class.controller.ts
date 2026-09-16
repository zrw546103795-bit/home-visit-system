import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { ClassService } from './class.service';
import type { HomeroomClass, Grade } from '@shared/api.interface';

interface CreateClassDto {
  grade: Grade;
  className: string;
}

interface UpdateClassDto {
  grade?: Grade;
  className?: string;
}

interface ClassGroup {
  grade: Grade;
  gradeLabel: string;
  classes: HomeroomClass[];
}

@Controller('api/classes')
export class ClassController {
  constructor(private readonly classService: ClassService) {}

  @Get()
  async list(
    @Req() req: Request,
  ): Promise<ClassGroup[]> {
    const teacherId = req.headers['x-teacher-id'] as string;
    if (!teacherId) {
      throw new UnauthorizedException('未登录');
    }
    // 所有登录用户都可以查看班级列表
    return this.classService.list();
  }

  @Get(':id')
  async getById(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<HomeroomClass> {
    const teacherId = req.headers['x-teacher-id'] as string;
    if (!teacherId) {
      throw new UnauthorizedException('未登录');
    }
    return this.classService.getById(id);
  }

  @Post()
  async create(
    @Req() req: Request,
    @Body() dto: CreateClassDto,
  ): Promise<HomeroomClass> {
    const teacherId = req.headers['x-teacher-id'] as string;
    if (!teacherId) {
      throw new UnauthorizedException('未登录');
    }
    await this.classService.requireAdmin(teacherId);
    return this.classService.create(dto);
  }

  @Patch(':id')
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateClassDto,
  ): Promise<HomeroomClass> {
    const teacherId = req.headers['x-teacher-id'] as string;
    if (!teacherId) {
      throw new UnauthorizedException('未登录');
    }
    await this.classService.requireAdmin(teacherId);
    return this.classService.update(id, dto);
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
    await this.classService.requireAdmin(teacherId);
    await this.classService.remove(id);
    return { id };
  }
}
