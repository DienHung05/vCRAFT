import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { CatalogService } from './application/catalog.service';
import { CatalogController } from './catalog.controller';

@Module({
  imports: [MediaModule],
  controllers: [CatalogController],
  providers: [CatalogService],
})
export class CatalogModule {}
