import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { ConsentModule } from '../privacy/consent.module';
import { QuotationNoticesService } from './application/quotation-notices.service';
import { QuotationNotifier } from './application/quotation-notifier';
import { RfqService } from './application/rfq.service';
import { QuotationNoticesController } from './quotation-notices.controller';
import {
  AdminCoordinationController,
  AllocationsController,
  ContributionsController,
  MyQuotationWorkController,
  RfqController,
} from './rfq.controller';

@Module({
  imports: [MediaModule, ConsentModule],
  controllers: [
    RfqController,
    AdminCoordinationController,
    MyQuotationWorkController,
    ContributionsController,
    AllocationsController,
    QuotationNoticesController,
  ],
  providers: [RfqService, QuotationNotifier, QuotationNoticesService],
  exports: [QuotationNotifier],
})
export class RfqModule {}
