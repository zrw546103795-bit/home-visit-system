import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './platform-shim';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    abortOnError: process.env.NODE_ENV !== 'development',
  });

  await configureApp(app, { disableSwagger: true });

  const logger = new Logger('Bootstrap');
  const host = process.env.HOST || '0.0.0.0';
  const port = Number(process.env.PORT || '3000');

  // 确保上传目录存在
  const uploadDir = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');
  if (!existsSync(uploadDir)) {
    mkdirSync(uploadDir, { recursive: true });
  }

  await app.listen(port, host);
  logger.log(`========================================`);
  logger.log(`  家访材料管理系统启动成功`);
  logger.log(`  服务地址: http://${host}:${port}`);
  logger.log(`  API 地址: http://${host}:${port}/api`);
  logger.log(`  上传目录: ${uploadDir}`);
  logger.log(`========================================`);
}

bootstrap().catch((err) => {
  console.error('应用启动失败:', err);
  process.exit(1);
});
