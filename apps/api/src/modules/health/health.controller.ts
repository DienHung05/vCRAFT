import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { Public } from '../../common/auth/auth.guard';
import { AppError } from '../../common/errors/app-error';
import { ReadinessService } from './readiness.service';

/**
 * NFR-REL-01. Two probes with different jobs:
 * - `GET /health` is **liveness**: `check([])` shows the process still answers. It touches no dependency on
 *   purpose, so an orchestrator never restarts the process just because a backing service flaps.
 * - `GET /health/ready` is **readiness**: a bounded `select 1` through the request pool. It answers 503 when the
 *   database is unreachable or the pool cannot hand out a connection, which is what a monitor should alert on
 *   (and a load balancer should stop routing on). Redis, storage and the worker are not checked here yet.
 */
@Controller('health')
@Public()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly readiness: ReadinessService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([]);
  }

  @Get('ready')
  async ready() {
    const report = await this.readiness.check();
    if (!report.ready) {
      throw new AppError('SERVICE_UNAVAILABLE', `database: ${report.reason ?? 'unavailable'}`);
    }
    return {
      status: 'ok',
      database: { status: 'up', responseTimeMs: report.databaseMs },
      ...(report.pool && { pool: report.pool }),
    };
  }
}
