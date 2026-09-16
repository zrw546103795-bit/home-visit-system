import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Query,
  Param,
} from '@nestjs/common';
import type { Request } from 'express';
import { NeedLogin } from '../../platform-shim';
import { AccessRequestService } from './access-request.service';
import type {
  AccessRequest,
  AccessRequestListParams,
  AccessRequestStatus,
  CreateAccessRequestDto,
  MyAccessRequestResponse,
  PaginatedResponse,
  ReviewAccessRequestDto,
} from '@shared/api.interface';

@Controller('api/access-request')
export class AccessRequestController {
  constructor(private readonly accessRequestService: AccessRequestService) {}

  @NeedLogin()
  @Post()
  async createRequest(
    @Body() body: CreateAccessRequestDto,
    @Req() req: Request,
  ): Promise<{ request: AccessRequest }> {
    const { userId, userName } = req.userContext;
    return this.accessRequestService.createRequest(body, userId, userName);
  }

  @NeedLogin()
  @Get('my')
  async getMyRequest(
    @Req() req: Request,
  ): Promise<MyAccessRequestResponse> {
    const { userId } = req.userContext;
    return this.accessRequestService.getMyRequest(userId);
  }

  @NeedLogin()
  @Get('pending-count')
  async getPendingCount(
    @Req() req: Request,
  ): Promise<{ count: number }> {
    const { userId, roles } = req.userContext;
    return this.accessRequestService.getPendingCount(userId, roles);
  }

  @NeedLogin()
  @Get()
  async getRequestList(
    @Query() query: AccessRequestListParams,
    @Req() req: Request,
  ): Promise<PaginatedResponse<AccessRequest>> {
    const { userId, roles } = req.userContext;
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 10;
    const status = query.status as AccessRequestStatus | undefined;
    return this.accessRequestService.getRequestList(userId, roles, page, pageSize, status);
  }

  @NeedLogin()
  @Post(':id/review')
  async reviewRequest(
    @Param('id') id: string,
    @Body() body: ReviewAccessRequestDto,
    @Req() req: Request,
  ): Promise<{ success: boolean; message: string; user?: import('@shared/api.interface').CurrentUser }> {
    const { userId, roles } = req.userContext;
    return this.accessRequestService.reviewRequest(userId, roles, id, body, userId);
  }
}
