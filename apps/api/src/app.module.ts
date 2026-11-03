import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AuthModule } from './common/auth/auth.module';
import { ProblemDetailsFilter } from './common/filters/problem-details.filter';
import { CryptoModule } from './infrastructure/crypto/crypto.module';
import { DatabaseModule } from './infrastructure/database/database.module';
import { StorageModule } from './infrastructure/storage/storage.module';
import { VectorModule } from './infrastructure/vector/vector.module';
import { AdminModule } from './modules/admin/admin.module';
import { AssistantModule } from './modules/assistant/assistant.module';
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
    CryptoModule,
    StorageModule,
    VectorModule,
    AuthModule,
    HealthModule,
    AdminModule,
    AssistantModule,
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
