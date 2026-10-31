import { Module } from '@nestjs/common';
import { AuditLogController } from './admin.controller';
import { AuditLogService } from './application/audit-log.service';

@Module({
  controllers: [AuditLogController],
  providers: [AuditLogService],
})
export class AdminModule {}
