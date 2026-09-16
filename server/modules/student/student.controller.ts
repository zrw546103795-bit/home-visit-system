import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { StudentService } from './student.service';
import type {
  Student,
  StudentListParams,
  CreateStudentDto,
  PaginatedResponse,
  Grade,
} from '@shared/api.interface';

@Controller('api/students')
export class StudentController {
  constructor(private readonly studentService: StudentService) {}

  @Get()
  async list(
    @Req() req: Request,
    @Query('page', ParseIntPipe) page: number,
    @Query('pageSize', ParseIntPipe) pageSize: number,
    @Query('name') name?: string,
    @Query('grade') grade?: Grade,
    @Query('className') className?: string,
  ): Promise<PaginatedResponse<Student>> {
    const teacherId = req.headers['x-teacher-id'] as string;
    if (!teacherId) {
      throw new UnauthorizedException('未登录');
    }
    await this.studentService.requireAdmin(teacherId);
    const params: StudentListParams = {
      page,
      pageSize,
      name: name || undefined,
      grade,
      className: className || undefined,
    };
    return this.studentService.list(params);
  }

  @Get('by-class/:classId')
  async getByClassId(
    @Req() req: Request,
    @Param('classId') classId: string,
  ): Promise<Student[]> {
    const teacherId = req.headers['x-teacher-id'] as string;
    if (!teacherId) {
      throw new UnauthorizedException('未登录');
    }
    // 所有登录用户都可以按班级查学生（家访时选学生用）
    return this.studentService.getByClassId(classId);
  }

  @Get(':id')
  async getById(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<Student> {
    const teacherId = req.headers['x-teacher-id'] as string;
    if (!teacherId) {
      throw new UnauthorizedException('未登录');
    }
    await this.studentService.requireAdmin(teacherId);
    return this.studentService.getById(id);
  }

  @Post()
  async create(
    @Req() req: Request,
    @Body() dto: CreateStudentDto,
  ): Promise<Student> {
    const teacherId = req.headers['x-teacher-id'] as string;
    if (!teacherId) {
      throw new UnauthorizedException('未登录');
    }
    await this.studentService.requireAdmin(teacherId);
    return this.studentService.create(dto);
  }

  @Patch(':id')
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: Partial<CreateStudentDto>,
  ): Promise<Student> {
    const teacherId = req.headers['x-teacher-id'] as string;
    if (!teacherId) {
      throw new UnauthorizedException('未登录');
    }
    await this.studentService.requireAdmin(teacherId);
    return this.studentService.update(id, dto);
  }

  @Delete(':id')
  async remove(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<void> {
    const teacherId = req.headers['x-teacher-id'] as string;
    if (!teacherId) {
      throw new UnauthorizedException('未登录');
    }
    await this.studentService.requireAdmin(teacherId);
    return this.studentService.remove(id);
  }
}
