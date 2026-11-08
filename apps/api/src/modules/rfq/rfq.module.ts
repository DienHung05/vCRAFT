import { Module } from '@nestjs/common';
import { IdempotencyModule } from '../../common/idempotency/idempotency.module';
import { MediaModule } from '../media/media.module';
import { ConsentModule } from '../privacy/consent.module';
import { AllocationScheduleService } from './application/allocation-schedule.service';
import { QuotationNoticesService } from './application/quotation-notices.service';
import { QuotationNotifier } from './application/quotation-notifier';
import { RfqService } from './application/rfq.service';
import { QuotationNoticesController } from './quotation-notices.controller';
import {
  AdminAllocationsController,
  AdminCoordinationController,
  AllocationsController,
  ContributionsController,
  DirectQuotationsController,
  MyQuotationWorkController,
  RfqController,
} from './rfq.controller';

@Module({
  imports: [MediaModule, ConsentModule, IdempotencyModule],
  controllers: [
    RfqController,
    AdminCoordinationController,
    AdminAllocationsController,
    MyQuotationWorkController,
    ContributionsController,
    DirectQuotationsController,
    AllocationsController,
    QuotationNoticesController,
  ],
  providers: [RfqService, QuotationNotifier, QuotationNoticesService, AllocationScheduleService],
  exports: [QuotationNotifier],
})
export class RfqModule {}
