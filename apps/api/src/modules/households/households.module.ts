import { Module } from '@nestjs/common';
import { IdempotencyModule } from '../../common/idempotency/idempotency.module';
import { AssistantModule } from '../assistant/assistant.module';
import { MediaModule } from '../media/media.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ConsentModule } from '../privacy/consent.module';
import { HouseholdsService } from './application/households.service';
import { QrLabelsService } from './application/qr-labels.service';
import { StorySuggestionService } from './application/story-suggestion.service';
import {
  AdminDashboardController,
  AdminHouseholdsController,
  HouseholdSlugController,
  MyHouseholdController,
  ProductPublicationController,
  PublicHouseholdsController,
} from './households.controller';

@Module({
  imports: [MediaModule, NotificationsModule, ConsentModule, AssistantModule, IdempotencyModule],
  controllers: [
    MyHouseholdController,
    ProductPublicationController,
    AdminDashboardController,
    AdminHouseholdsController,
    // Before PublicHouseholdsController, whose `households/:slug` would otherwise swallow the path.
    HouseholdSlugController,
    PublicHouseholdsController,
  ],
  providers: [HouseholdsService, QrLabelsService, StorySuggestionService],
  exports: [HouseholdsService],
})
export class HouseholdsModule {}
