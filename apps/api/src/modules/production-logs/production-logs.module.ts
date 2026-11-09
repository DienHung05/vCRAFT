import { Module } from '@nestjs/common';
import { IdempotencyModule } from '../../common/idempotency/idempotency.module';
import { MediaModule } from '../media/media.module';
import { JournalService } from './application/journal.service';
import { ProductionLogsController } from './production-logs.controller';

@Module({
  imports: [MediaModule, IdempotencyModule],
  controllers: [ProductionLogsController],
  providers: [JournalService],
})
export class ProductionLogsModule {}
