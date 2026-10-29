import { Module } from '@nestjs/common';
import { HouseholdsService } from './application/households.service';
import {
  AdminHouseholdsController,
  MyHouseholdController,
  ProductPublicationController,
  PublicHouseholdsController,
} from './households.controller';

@Module({
  controllers: [
    MyHouseholdController,
    ProductPublicationController,
    AdminHouseholdsController,
    PublicHouseholdsController,
  ],
  providers: [HouseholdsService],
  exports: [HouseholdsService],
})
export class HouseholdsModule {}
