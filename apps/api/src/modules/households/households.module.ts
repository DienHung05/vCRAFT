import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { HouseholdsService } from './application/households.service';
import {
  AdminHouseholdsController,
  MyHouseholdController,
  ProductPublicationController,
  PublicHouseholdsController,
} from './households.controller';

@Module({
  imports: [MediaModule],
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
