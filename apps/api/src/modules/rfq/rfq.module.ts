import { Module } from '@nestjs/common';
import { QuotationNoticesService } from './application/quotation-notices.service';
import { QuotationNotifier } from './application/quotation-notifier';
import { RfqService } from './application/rfq.service';
import { QuotationNoticesController } from './quotation-notices.controller';
import {
  AdminCoordinationController,
  AllocationsController,
  ContributionsController,
  RfqController,
} from './rfq.controller';

@Module({
  controllers: [
    RfqController,
    AdminCoordinationController,
    ContributionsController,
    AllocationsController,
    QuotationNoticesController,
  ],
  providers: [RfqService, QuotationNotifier, QuotationNoticesService],
})
export class RfqModule {}
