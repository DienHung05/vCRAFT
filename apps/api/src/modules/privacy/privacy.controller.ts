import { Body, Controller, Delete, Get, Header, HttpCode } from '@nestjs/common';
import { type DeleteAccountRequest, DeleteAccountRequestSchema } from '@vcraft/contracts';
import { type Actor, CurrentActor } from '../../common/auth/auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AccountDeletionService } from './application/account-deletion.service';
import { DataExportService } from './application/data-export.service';

/**
 * Personal data rights of the signed-in person (NFR-SEC-07): download everything held about them, and
 * delete the account. Open to every role; an administrator's deletion is refused by the service.
 */
@Controller('me')
export class PrivacyController {
  constructor(
    private readonly exports: DataExportService,
    private readonly deletion: AccountDeletionService,
  ) {}

  @Get('data-export')
  @Header('Cache-Control', 'private, no-store')
  @Header('Content-Disposition', 'attachment; filename="vcraft-my-data.json"')
  dataExport(@CurrentActor() actor: Actor) {
    return this.exports.export(actor);
  }

  @Delete()
  @HttpCode(204)
  async deleteAccount(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(DeleteAccountRequestSchema)) body: DeleteAccountRequest,
  ) {
    await this.deletion.delete(actor, body);
  }
}
