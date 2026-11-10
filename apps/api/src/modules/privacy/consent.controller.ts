import { Body, Controller, Delete, Get, Header, Param, Post } from '@nestjs/common';
import {
  ConsentPurposeSchema,
  type RecordConsentRequest,
  RecordConsentRequestSchema,
} from '@vcraft/contracts';
import type { ConsentPurpose } from '@vcraft/domain';
import { type Actor, CurrentActor } from '../../common/auth/auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ConsentService } from './application/consent.service';

/** Consent given by the signed-in person (NFR-SEC-07). Every signed-in role, including locked accounts. */
@Controller('me/consents')
export class ConsentController {
  constructor(private readonly consents: ConsentService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  list(@CurrentActor() actor: Actor) {
    return this.consents.list(actor);
  }

  @Post()
  record(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(RecordConsentRequestSchema)) body: RecordConsentRequest,
  ) {
    return this.consents.record(actor, body);
  }

  /** Withdraw one consent (Decree 13/2023/ND-CP Art. 12). Answers with the refreshed list. */
  @Delete(':purpose')
  withdraw(
    @CurrentActor() actor: Actor,
    @Param('purpose', new ZodValidationPipe(ConsentPurposeSchema)) purpose: ConsentPurpose,
  ) {
    return this.consents.withdraw(actor, purpose);
  }
}
