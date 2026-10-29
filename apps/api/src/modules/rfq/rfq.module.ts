import { Module } from '@nestjs/common';
import { RfqService } from './application/rfq.service';
import { QuotationNoticesController } from './quotation-notices.controller';
import { ContributionsController, RfqController } from './rfq.controller';

@Module({
  controllers: [RfqController, ContributionsController, QuotationNoticesController],
  providers: [RfqService],
})
export class RfqModule {}
