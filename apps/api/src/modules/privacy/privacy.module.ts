import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { RfqModule } from '../rfq/rfq.module';
import { AccountDeletionService } from './application/account-deletion.service';
import { DataExportService } from './application/data-export.service';
import { PrivacyController } from './privacy.controller';

/** Download and deletion of the signed-in person's data (NFR-SEC-07). Consent lives in `ConsentModule`. */
@Module({
  imports: [MediaModule, RfqModule],
  controllers: [PrivacyController],
  providers: [DataExportService, AccountDeletionService],
})
export class PrivacyModule {}
