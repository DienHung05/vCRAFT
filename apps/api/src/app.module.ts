import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './common/auth/auth.module';
import { ProblemDetailsFilter } from './common/filters/problem-details.filter';
import { ClientThrottlerGuard } from './common/rate-limit/client-throttler.guard';
import { rateLimitConfig, throttlerOptions } from './common/rate-limit/rate-limit.config';
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
import { PaymentsModule } from './modules/payments/payments.module';
import { ConsentModule } from './modules/privacy/consent.module';
import { PrivacyModule } from './modules/privacy/privacy.module';
import { ProductionLogsModule } from './modules/production-logs/production-logs.module';
import { RfqModule } from './modules/rfq/rfq.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    // Read the env at module init, after `dotenv/config` has run.
    ThrottlerModule.forRootAsync({ useFactory: () => throttlerOptions(rateLimitConfig()) }),
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
    PaymentsModule,
    PrivacyModule,
    ProductionLogsModule,
    RfqModule,
    UsersModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
    // Registered in the root module so it runs before the `AuthGuard`: unauthenticated floods are counted too.
    { provide: APP_GUARD, useClass: ClientThrottlerGuard },
  ],
})
export class AppModule {}
