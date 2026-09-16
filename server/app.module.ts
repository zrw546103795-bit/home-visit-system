import { APP_FILTER } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PlatformModule } from './platform-shim';
import { DatabaseModule } from './database/database.module';
import { GlobalExceptionFilter } from './common/filters/exception.filter';
import { ViewModule } from './modules/view/view.module';
import { AuthModule } from './modules/auth/auth.module';
import { ClassModule } from './modules/class/class.module';
import { TeacherModule } from './modules/teacher/teacher.module';
import { StudentModule } from './modules/student/student.module';
import { HomeVisitModule } from './modules/home-visit/home-visit.module';
import { StatsModule } from './modules/stats/stats.module';
import { ImportModule } from './modules/import/import.module';
import { AccessRequestModule } from './modules/access-request/access-request.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PlatformModule.forRoot(),
    DatabaseModule,
    AuthModule,
    ClassModule,
    TeacherModule,
    StudentModule,
    HomeVisitModule,
    StatsModule,
    ImportModule,
    AccessRequestModule,
    ViewModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
