import { type PipeTransform } from '@nestjs/common';
import { zodErrorToFieldErrors } from '@vcraft/contracts';
import type { z } from 'zod';
import { AppError } from '../errors/app-error';

/** Kiểm tra body/query bằng schema của `@vcraft/contracts` (ARCHITECTURE §4.2). Lỗi ⇒ 422 kèm `errors[]`. */
export class ZodValidationPipe<S extends z.ZodType> implements PipeTransform<unknown, z.infer<S>> {
  constructor(readonly schema: S) {}

  transform(value: unknown): z.infer<S> {
    const result = this.schema.safeParse(value ?? {});
    if (!result.success) {
      throw new AppError('VALIDATION_FAILED', undefined, zodErrorToFieldErrors(result.error));
    }
    return result.data;
  }
}
