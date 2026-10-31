import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { HouseholdsService } from './application/households.service';
import {
  AdminDashboardController,
  AdminHouseholdsController,
  MyHouseholdController,
  ProductPublicationController,
  PublicHouseholdsController,
} from './households.controller';

@Module({
  imports: [MediaModule, NotificationsModule],
  controllers: [
    MyHouseholdController,
    ProductPublicationController,
    AdminDashboardController,
    AdminHouseholdsController,
    PublicHouseholdsController,
  ],
  providers: [HouseholdsService],
  exports: [HouseholdsService],
})
export class HouseholdsModule {}
