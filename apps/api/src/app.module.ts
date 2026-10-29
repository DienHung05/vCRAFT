import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AuthModule } from './common/auth/auth.module';
import { ProblemDetailsFilter } from './common/filters/problem-details.filter';
import { DatabaseModule } from './infrastructure/database/database.module';
import { HealthModule } from './modules/health/health.module';
import { HouseholdsModule } from './modules/households/households.module';
import { ProductionLogsModule } from './modules/production-logs/production-logs.module';

@Module({
  imports: [DatabaseModule, AuthModule, HealthModule, HouseholdsModule, ProductionLogsModule],
  providers: [{ provide: APP_FILTER, useClass: ProblemDetailsFilter }],
})
export class AppModule {}
