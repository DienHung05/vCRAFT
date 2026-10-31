import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { NewsService } from './application/news.service';
import { NewsAdminService } from './application/news-admin.service';
import { AdminNewsController, NewsController, VillageNewsController } from './news.controller';

@Module({
  imports: [MediaModule],
  controllers: [VillageNewsController, NewsController, AdminNewsController],
  providers: [NewsService, NewsAdminService],
})
export class NewsModule {}
