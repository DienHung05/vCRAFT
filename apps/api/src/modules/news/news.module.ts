import { Module } from '@nestjs/common';
import { NewsService } from './application/news.service';
import { NewsController } from './news.controller';

@Module({
  controllers: [NewsController],
  providers: [NewsService],
})
export class NewsModule {}
