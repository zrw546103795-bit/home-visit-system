import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import type { LoginDto, LoginResponse, CurrentUser, RegisterDto, BindAccountDto, BindAccountResponse } from '@shared/api.interface';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(
    @Body() body: LoginDto,
  ): Promise<LoginResponse> {
    const { account, password } = body;

    if (!account || !password) {
      throw new UnauthorizedException('账号和密码不能为空');
    }

    return this.authService.login(account, password);
  }

  @Post('register')
  async register(
    @Body() body: RegisterDto,
  ): Promise<{ success: boolean; message: string; user?: CurrentUser }> {
    return this.authService.register(body);
  }

  @Get('me')
  async getCurrentUser(@Req() req: Request): Promise<CurrentUser> {
    const teacherId = req.headers['x-teacher-id'] as string;
    if (!teacherId) {
      throw new UnauthorizedException('未登录');
    }
    return this.authService.getCurrentUser(teacherId);
  }

  @Post('bind')
  async bindAccount(
    @Body() body: BindAccountDto,
    @Req() req: Request,
  ): Promise<BindAccountResponse> {
    const teacherId = req.headers['x-teacher-id'] as string;
    const { account, password } = body;
    return this.authService.bindAccount(teacherId, account, password);
  }
}
