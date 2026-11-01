import { Body, Controller, Get, Header, Post } from '@nestjs/common';
import { type RecordConsentRequest, RecordConsentRequestSchema } from '@vcraft/contracts';
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
}
