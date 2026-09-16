import { Controller, Post, Get, Body, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { ImportService } from './import.service';
import type {
  CreateTeacherDto,
  CreateStudentDto,
  ImportResult,
} from '@shared/api.interface';

interface ImportTeachersBody {
  data: CreateTeacherDto[];
}

interface ImportStudentsBody {
  data: CreateStudentDto[];
}

interface TemplateField {
  field: string;
  label: string;
  required: boolean;
  description: string;
}

interface TemplateResponse {
  fields: TemplateField[];
  example: Record<string, string>;
}

@Controller('api/import')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('teachers')
  async importTeachers(
    @Req() req: Request,
    @Body() body: ImportTeachersBody,
  ): Promise<ImportResult> {
    const teacherId = req.headers['x-teacher-id'] as string;
    if (!teacherId) {
      throw new UnauthorizedException('未登录');
    }
    await this.importService.requireAdmin(teacherId);
    return this.importService.importTeachers(body.data);
  }

  @Post('students')
  async importStudents(
    @Req() req: Request,
    @Body() body: ImportStudentsBody,
  ): Promise<ImportResult> {
    const teacherId = req.headers['x-teacher-id'] as string;
    if (!teacherId) {
      throw new UnauthorizedException('未登录');
    }
    await this.importService.requireAdmin(teacherId);
    return this.importService.importStudents(body.data);
  }

  @Get('template/teachers')
  getTeacherTemplate(
    @Req() req: Request,
  ): TemplateResponse {
    const teacherId = req.headers['x-teacher-id'] as string;
    if (!teacherId) {
      throw new UnauthorizedException('未登录');
    }
    return this.importService.getTeacherTemplate();
  }

  @Get('template/students')
  getStudentTemplate(
    @Req() req: Request,
  ): TemplateResponse {
    const teacherId = req.headers['x-teacher-id'] as string;
    if (!teacherId) {
      throw new UnauthorizedException('未登录');
    }
    return this.importService.getStudentTemplate();
  }
}
