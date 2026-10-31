import { Controller, Get, Header, Query } from '@nestjs/common';
import { type AuditLogQuery, AuditLogQuerySchema } from '@vcraft/contracts';
import { Roles } from '../../common/auth/auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuditLogService } from './application/audit-log.service';

@Controller('admin/audit-log')
@Roles('ADMIN')
export class AuditLogController {
  constructor(private readonly audit: AuditLogService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  list(@Query(new ZodValidationPipe(AuditLogQuerySchema)) query: AuditLogQuery) {
    return this.audit.list(query);
  }

  @Get('actors')
  @Header('Cache-Control', 'private, no-store')
  actors() {
    return this.audit.actors();
  }
}
