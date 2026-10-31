import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { NewsService } from './application/news.service';
import { NewsController } from './news.controller';

@Module({
  imports: [MediaModule],
  controllers: [NewsController],
  providers: [NewsService],
})
export class NewsModule {}
