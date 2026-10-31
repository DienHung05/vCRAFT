import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
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
  imports: [MediaModule],
  controllers: [
    RfqController,
    AdminCoordinationController,
    MyQuotationWorkController,
    ContributionsController,
    AllocationsController,
    QuotationNoticesController,
  ],
  providers: [RfqService, QuotationNotifier, QuotationNoticesService],
})
export class RfqModule {}
