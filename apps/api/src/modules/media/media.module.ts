import { Module } from '@nestjs/common';
import { ConsentModule } from '../privacy/consent.module';
import { MediaService } from './application/media.service';
import { MediaController } from './media.controller';

@Module({
  imports: [ConsentModule],
  controllers: [MediaController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
