import { Module } from '@nestjs/common';
import { AdminInvitationsController, AdminUsersController } from './account-admin.controller';
import { AuditLogController } from './admin.controller';
import { AccountAdminService } from './application/account-admin.service';
import { AuditLogService } from './application/audit-log.service';

@Module({
  controllers: [AuditLogController, AdminUsersController, AdminInvitationsController],
  providers: [AuditLogService, AccountAdminService],
})
export class AdminModule {}
