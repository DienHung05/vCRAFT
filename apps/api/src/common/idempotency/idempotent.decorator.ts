import { UseInterceptors } from '@nestjs/common';
import { IdempotencyInterceptor } from './idempotency.interceptor';

/**
 * Marks a state-changing POST as safe to retry (BR-L5): with an `Idempotency-Key` header, a repeat from
 * the same actor with the same body replays the first 2xx response. Without the header nothing changes.
 */
export const Idempotent = () => UseInterceptors(IdempotencyInterceptor);
