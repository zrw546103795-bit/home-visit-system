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
  Res,
  UnauthorizedException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { HomeVisitService } from './home-visit.service';
import { FileService } from '../../platform-shim';
import type {
  HomeVisitRecord,
  HomeVisitAttachment,
  PaginatedResponse,
  RecordListParams,
  CreateRecordDto,
  UpdateRecordDto,
  Grade,
  VisitForm,
  VisitCategory,
  BatchDownloadDto,
} from '@shared/api.interface';

@Controller('api/home-visit')
export class HomeVisitController {
  constructor(
    private readonly homeVisitService: HomeVisitService,
    private readonly fileService: FileService,
  ) {}

  /**
   * 家访记录列表（分页+筛选）
   */
  @Get('records')
  async list(
    @Req() req: Request,
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '10',
    @Query('studentName') studentName?: string,
    @Query('grade') grade?: Grade,
    @Query('className') className?: string,
    @Query('visitForm') visitForm?: VisitForm,
    @Query('category') category?: VisitCategory,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('teacherId') teacherId?: string,
    @Query('month') month?: string,
  ): Promise<PaginatedResponse<HomeVisitRecord>> {
    const headerTeacherId = req.headers['x-teacher-id'] as string;
    if (!headerTeacherId) {
      throw new UnauthorizedException('未登录');
    }
    const params: RecordListParams = {
      page: parseInt(page, 10),
      pageSize: parseInt(pageSize, 10),
      studentName,
      grade,
      className,
      visitForm,
      category,
      startDate,
      endDate,
      teacherId,
      month,
    };
    return this.homeVisitService.list(params, headerTeacherId);
  }

  /**
   * 导出家访记录为 CSV
   */
  @Get('records/export')
  async exportRecords(
    @Req() req: Request,
    @Res() res: Response,
    @Query('studentName') studentName?: string,
    @Query('grade') grade?: Grade,
    @Query('className') className?: string,
    @Query('visitForm') visitForm?: VisitForm,
    @Query('category') category?: VisitCategory,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('teacherId') teacherId?: string,
    @Query('month') month?: string,
  ): Promise<void> {
    const headerTeacherId = req.headers['x-teacher-id'] as string;
    if (!headerTeacherId) {
      throw new UnauthorizedException('未登录');
    }
    const params: RecordListParams = {
      page: 1,
      pageSize: 5000,
      studentName,
      grade,
      className,
      visitForm,
      category,
      startDate,
      endDate,
      teacherId,
      month,
    };
    const { buffer, filename } = await this.homeVisitService.exportRecords(
      params,
      headerTeacherId,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(filename)}"`,
    );
    res.setHeader('Content-Length', buffer.length.toString());
    res.end(buffer);
  }

  /**
   * 批量下载附件为 zip
   */
  @Post('records/batch-download')
  async batchDownload(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: BatchDownloadDto,
  ): Promise<void> {
    const teacherId = req.headers['x-teacher-id'] as string;
    if (!teacherId) {
      throw new UnauthorizedException('未登录');
    }
    const { zipBuffer, filename } = await this.homeVisitService.batchDownload(
      body.recordIds,
      teacherId,
    );
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(filename)}"`,
    );
    res.setHeader('Content-Length', zipBuffer.length.toString());
    res.end(zipBuffer);
  }

  /**
   * 获取单条家访记录详情
   */
  @Get('records/:id')
  async getById(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<HomeVisitRecord> {
    const teacherId = req.headers['x-teacher-id'] as string;
    if (!teacherId) {
      throw new UnauthorizedException('未登录');
    }
    return this.homeVisitService.getById(id, teacherId);
  }

  /**
   * 新增家访记录
   */
  @Post('records')
  async create(
    @Req() req: Request,
    @Body() dto: CreateRecordDto,
  ): Promise<HomeVisitRecord> {
    const teacherId = req.headers['x-teacher-id'] as string;
    if (!teacherId) {
      throw new UnauthorizedException('未登录');
    }
    return this.homeVisitService.create(dto, teacherId);
  }

  /**
   * 编辑家访记录
   */
  @Patch('records/:id')
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateRecordDto,
  ): Promise<HomeVisitRecord> {
    const teacherId = req.headers['x-teacher-id'] as string;
    if (!teacherId) {
      throw new UnauthorizedException('未登录');
    }
    return this.homeVisitService.update(id, dto, teacherId);
  }

  /**
   * 删除家访记录
   */
  @Delete('records/:id')
  async remove(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<void> {
    const teacherId = req.headers['x-teacher-id'] as string;
    if (!teacherId) {
      throw new UnauthorizedException('未登录');
    }
    return this.homeVisitService.remove(id, teacherId);
  }

  /**
   * 文件上传
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ bucket_id: string; file_path: string }> {
    if (!file) {
      throw new Error('未收到文件');
    }
    const result = await this.fileService.upload({
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
    });
    return {
      bucket_id: result.bucket_id,
      file_path: result.file_path,
    };
  }

  /**
   * 上传附件（从请求体获取 bucketId 和 filePath）
   */
  @Post('records/:id/attachments')
  async addAttachment(
    @Req() req: Request,
    @Param('id') recordId: string,
    @Body()
    body: {
      fileName: string;
      fileSize: number;
      bucketId: string;
      filePath: string;
    },
  ): Promise<HomeVisitAttachment> {
    const teacherId = req.headers['x-teacher-id'] as string;
    if (!teacherId) {
      throw new UnauthorizedException('未登录');
    }
    return this.homeVisitService.addAttachment(recordId, body, teacherId);
  }

  /**
   * 删除附件
   */
  @Delete('attachments/:id')
  async removeAttachment(
    @Req() req: Request,
    @Param('id') attachmentId: string,
  ): Promise<void> {
    const teacherId = req.headers['x-teacher-id'] as string;
    if (!teacherId) {
      throw new UnauthorizedException('未登录');
    }
    return this.homeVisitService.removeAttachment(
      attachmentId,
      teacherId,
    );
  }

  /**
   * 获取附件下载链接
   */
  @Get('attachments/:id/download')
  async getDownloadUrl(
    @Req() req: Request,
    @Param('id') attachmentId: string,
  ): Promise<{ downloadUrl: string }> {
    const teacherId = req.headers['x-teacher-id'] as string;
    if (!teacherId) {
      throw new UnauthorizedException('未登录');
    }
    return this.homeVisitService.getDownloadUrl(
      attachmentId,
      teacherId,
    );
  }
}
