/**
 * 平台兼容层 - 模拟 @lark-apaas/fullstack-nestjs-core 的接口
 * 使业务代码无需修改即可在独立环境运行
 */
import { Module, Global, Injectable, Logger, SetMetadata, UseGuards, CanActivate, ExecutionContext } from '@nestjs/common';
import { join } from 'path';
import { existsSync, mkdirSync, createReadStream, createWriteStream, unlinkSync, statSync } from 'fs';
import type { NestExpressApplication } from '@nestjs/platform-express';

// ========== 登录守卫（独立环境为空操作，使用系统自己的 token 鉴权） ==========
export class NeedLoginGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    return true;
  }
}

export const NeedLogin = () => UseGuards(NeedLoginGuard);

// ========== 数据库 ==========
export const DRIZZLE_DATABASE = 'DRIZZLE_DATABASE';
export type PostgresJsDatabase = any;

// ========== 文件服务 ==========
export interface FileUploadResult {
  bucket_id: string;
  file_path: string;
  url?: string;
}

@Injectable()
export class FileService {
  private readonly logger = new Logger(FileService.name);
  private uploadDir: string;

  constructor() {
    this.uploadDir = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');
    if (!existsSync(this.uploadDir)) {
      mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  /**
   * 上传文件
   */
  async upload(file: { buffer: Buffer; originalname: string; mimetype: string }): Promise<FileUploadResult> {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `${timestamp}_${safeName}`;
    const filePath = join(this.uploadDir, fileName);

    createWriteStream(filePath).write(file.buffer);

    this.logger.log(`文件上传成功: ${fileName}`);
    return {
      bucket_id: 'local',
      file_path: fileName,
    };
  }

  /**
   * 获取文件下载 URL
   */
  getDownloadUrl(bucketId: string, filePath: string): string {
    return `/uploads/${filePath}`;
  }

  /**
   * 获取文件流
   */
  getFileStream(filePath: string) {
    const fullPath = join(this.uploadDir, filePath);
    if (!existsSync(fullPath)) {
      throw new Error('文件不存在');
    }
    return createReadStream(fullPath);
  }

  /**
   * 获取文件信息
   */
  getFileInfo(filePath: string) {
    const fullPath = join(this.uploadDir, filePath);
    if (!existsSync(fullPath)) {
      return null;
    }
    const stat = statSync(fullPath);
    return {
      size: stat.size,
      path: fullPath,
    };
  }

  /**
   * 删除文件
   */
  async delete(filePath: string): Promise<void> {
    const fullPath = join(this.uploadDir, filePath);
    if (existsSync(fullPath)) {
      unlinkSync(fullPath);
      this.logger.log(`文件删除: ${filePath}`);
    }
  }
}

// ========== 平台模块 ==========
@Global()
@Module({
  providers: [FileService],
  exports: [FileService],
})
export class PlatformModule {
  static forRoot() {
    return {
      module: PlatformModule,
    };
  }
}

// ========== 应用配置 ==========
export async function configureApp(app: NestExpressApplication, options?: { disableSwagger?: boolean }) {
  // 启用 CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // 静态文件服务 - 上传的文件
  const uploadDir = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');
  if (!existsSync(uploadDir)) {
    mkdirSync(uploadDir, { recursive: true });
  }
  app.useStaticAssets(uploadDir, { prefix: '/uploads/' });

  // 静态文件服务 - 前端构建产物
  const clientDist = join(process.cwd(), 'dist', 'client');
  if (existsSync(clientDist)) {
    app.useStaticAssets(clientDist, { prefix: '/' });
  }

  const logger = new Logger('Bootstrap');
  logger.log('应用配置完成（独立模式）');
}
