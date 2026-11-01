import { Global, Module } from '@nestjs/common';
import { createFieldCipher, FieldCipher } from '@vcraft/database';

/**
 * Field-level encryption (NFR-SEC-03). The factory runs while the application is built, so a missing or
 * malformed `FIELD_ENCRYPTION_KEYS` stops the API at startup instead of failing on the first request.
 * Tests replace the provider with a cipher that has a throwaway key.
 */
@Global()
@Module({
  providers: [{ provide: FieldCipher, useFactory: () => createFieldCipher(process.env) }],
  exports: [FieldCipher],
})
export class CryptoModule {}
