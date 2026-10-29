import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { Public } from '../../common/auth/auth.guard';

/**
 * NFR-REL-01. Hiện đây chỉ là **liveness**: `check([])` cho biết tiến trình còn phản hồi, KHÔNG chứng minh
 * DB, Redis, storage hay worker sẵn sàng. Khi nối các thành phần đó, tách thêm endpoint readiness
 * (vd. `GET /health/ready`, kiểm tra phụ thuộc) và để `GET /health` (liveness) không phụ thuộc chúng,
 * tránh orchestrator khởi động lại tiến trình chỉ vì một dịch vụ ngoài chập chờn.
 */
@Controller('health')
@Public()
export class HealthController {
  constructor(private readonly health: HealthCheckService) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([]);
  }
}
