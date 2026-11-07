import multipart from '@fastify/multipart';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { applyVietnameseZodErrors } from '@vcraft/contracts';
import { MEDIA_MAX_BYTES } from '@vcraft/domain';

/** Cấu hình HTTP dùng chung cho `main.ts` và ứng dụng dựng trong integration test. */
export async function configureHttp(app: NestFastifyApplication): Promise<void> {
  app.setGlobalPrefix('api/v1');
  // Validation messages in the same language as the rest of the error catalogue (GH#256): a missing field
  // reads "Trường này là bắt buộc", not Zod's English default. Messages set in a schema still win.
  applyVietnameseZodErrors();
  // FR-MEDIA-03: một tệp mỗi request; vượt giới hạn thì `toBuffer()` ném lỗi, service đổi thành 413.
  await app.register(multipart, {
    limits: { fileSize: MEDIA_MAX_BYTES, files: 1, fields: 5, parts: 6 },
  });
}
