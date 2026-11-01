import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AuthModule } from './common/auth/auth.module';
import { ProblemDetailsFilter } from './common/filters/problem-details.filter';
import { DatabaseModule } from './infrastructure/database/database.module';
import { StorageModule } from './infrastructure/storage/storage.module';
import { AdminModule } from './modules/admin/admin.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { HealthModule } from './modules/health/health.module';
import { HouseholdsModule } from './modules/households/households.module';
import { MediaModule } from './modules/media/media.module';
import { NewsModule } from './modules/news/news.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ConsentModule } from './modules/privacy/consent.module';
import { PrivacyModule } from './modules/privacy/privacy.module';
import { ProductionLogsModule } from './modules/production-logs/production-logs.module';
import { RfqModule } from './modules/rfq/rfq.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    DatabaseModule,
    StorageModule,
    AuthModule,
    HealthModule,
    AdminModule,
    HouseholdsModule,
    CatalogModule,
    ConsentModule,
    MediaModule,
    NewsModule,
    NotificationsModule,
    PrivacyModule,
    ProductionLogsModule,
    RfqModule,
    UsersModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: ProblemDetailsFilter }],
})
export class AppModule {}
