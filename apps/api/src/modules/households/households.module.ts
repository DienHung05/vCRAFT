import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ConsentModule } from '../privacy/consent.module';
import { HouseholdsService } from './application/households.service';
import { QrLabelsService } from './application/qr-labels.service';
import {
  AdminDashboardController,
  AdminHouseholdsController,
  MyHouseholdController,
  ProductPublicationController,
  PublicHouseholdsController,
} from './households.controller';

@Module({
  imports: [MediaModule, NotificationsModule, ConsentModule],
  controllers: [
    MyHouseholdController,
    ProductPublicationController,
    AdminDashboardController,
    AdminHouseholdsController,
    PublicHouseholdsController,
  ],
  providers: [HouseholdsService, QrLabelsService],
  exports: [HouseholdsService],
})
export class HouseholdsModule {}
