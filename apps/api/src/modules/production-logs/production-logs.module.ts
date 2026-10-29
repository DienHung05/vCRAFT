import { Module } from '@nestjs/common';
import { JournalService } from './application/journal.service';
import { ProductionLogsController } from './production-logs.controller';

@Module({
  controllers: [ProductionLogsController],
  providers: [JournalService],
})
export class ProductionLogsModule {}
