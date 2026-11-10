import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import {
  type CreateJournalEntryRequest,
  CreateJournalEntryRequestSchema,
  type UpdateJournalEntryRequest,
  UpdateJournalEntryRequestSchema,
} from '@vcraft/contracts';
import { type Actor, CurrentActor, Roles } from '../../common/auth/auth.guard';
import { IfMatchVersion } from '../../common/http/if-match';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';
import { UuidPipe } from '../../common/pipes/uuid.pipe';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JournalService } from './application/journal.service';

/** Nhật ký sản xuất của sản phẩm do chính hộ ghi. */
@Controller()
@Roles('HOUSEHOLD')
export class ProductionLogsController {
  constructor(private readonly journal: JournalService) {}

  @Get('me/household/products/:id/journal')
  get(@CurrentActor() actor: Actor, @Param('id', new UuidPipe()) productId: string) {
    return this.journal.get(actor, productId);
  }

  /** Ghi thêm một mốc; có `supersedesEntryId` thì là mốc đính chính. */
  @Post('me/household/products/:id/journal')
  @Idempotent()
  append(
    @CurrentActor() actor: Actor,
    @Param('id', new UuidPipe()) productId: string,
    @Body(new ZodValidationPipe(CreateJournalEntryRequestSchema)) body: CreateJournalEntryRequest,
  ) {
    return this.journal.append(actor, productId, body);
  }

  @Patch('journal-entries/:id')
  update(
    @CurrentActor() actor: Actor,
    @Param('id', new UuidPipe()) entryId: string,
    @IfMatchVersion() version: number,
    @Body(new ZodValidationPipe(UpdateJournalEntryRequestSchema)) body: UpdateJournalEntryRequest,
  ) {
    return this.journal.updateDraft(actor, entryId, version, body);
  }

  @Delete('journal-entries/:id')
  @HttpCode(200)
  remove(
    @CurrentActor() actor: Actor,
    @Param('id', new UuidPipe()) entryId: string,
    @IfMatchVersion() version: number,
  ) {
    return this.journal.deleteDraft(actor, entryId, version);
  }
}
