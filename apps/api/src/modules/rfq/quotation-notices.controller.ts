import { Controller, Get, Header } from '@nestjs/common';
import { type Actor, CurrentActor, Roles } from '../../common/auth/auth.guard';
import { RfqService } from './application/rfq.service';

@Controller('me/quotation-notices')
@Roles('BUYER', 'ADMIN')
export class QuotationNoticesController {
  constructor(private readonly rfqs: RfqService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  get(@CurrentActor() actor: Actor) {
    return this.rfqs.listNotices(actor);
  }
}
