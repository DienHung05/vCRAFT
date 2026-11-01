import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { JournalService } from './application/journal.service';
import { ProductionLogsController } from './production-logs.controller';

@Module({
  imports: [MediaModule],
  controllers: [ProductionLogsController],
  providers: [JournalService],
})
export class ProductionLogsModule {}
