import { Controller, Get, Header, HttpCode, Param, Post } from '@nestjs/common';
import { type Actor, CurrentActor, Roles } from '../../common/auth/auth.guard';
import { UuidPipe } from '../../common/pipes/uuid.pipe';
import { QuotationNoticesService } from './application/quotation-notices.service';

/** Hộp thư in-app (GH#13): client hỏi lại theo chu kỳ, không có SSE. */
@Controller('me/quotation-notices')
@Roles('BUYER', 'ADMIN', 'HOUSEHOLD')
export class QuotationNoticesController {
  constructor(private readonly notices: QuotationNoticesService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  get(@CurrentActor() actor: Actor) {
    return this.notices.list(actor);
  }

  @Post('read-all')
  @HttpCode(200)
  readAll(@CurrentActor() actor: Actor) {
    return this.notices.markAllRead(actor);
  }

  @Post(':id/read')
  @HttpCode(200)
  read(@CurrentActor() actor: Actor, @Param('id', new UuidPipe()) id: string) {
    return this.notices.markRead(actor, id);
  }
}
