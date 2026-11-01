import { Module } from '@nestjs/common';
import { ConsentService } from './application/consent.service';
import { ConsentController } from './consent.controller';

/** Recorded consent. Kept apart from {@link PrivacyModule} so feature modules can require consent without import cycles. */
@Module({
  controllers: [ConsentController],
  providers: [ConsentService],
  exports: [ConsentService],
})
export class ConsentModule {}
