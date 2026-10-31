import { Module } from '@nestjs/common';
import { MediaService } from './application/media.service';
import { MediaController } from './media.controller';

@Module({
  controllers: [MediaController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
