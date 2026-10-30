import { Global, Module } from '@nestjs/common';
import { createObjectStorage } from '@vcraft/storage';

/** Token DI của `ObjectStorage` (ADR-14); test thay bằng `LocalObjectStorage` trỏ thư mục tạm. */
export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

@Global()
@Module({
  providers: [{ provide: OBJECT_STORAGE, useFactory: () => createObjectStorage() }],
  exports: [OBJECT_STORAGE],
})
export class StorageModule {}
