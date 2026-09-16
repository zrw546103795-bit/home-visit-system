import { Module } from '@nestjs/common';
import { HomeVisitController } from './home-visit.controller';
import { HomeVisitService } from './home-visit.service';

@Module({
  controllers: [HomeVisitController],
  providers: [HomeVisitService],
})
export class HomeVisitModule {}
