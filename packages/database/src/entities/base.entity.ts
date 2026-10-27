import { type Opt } from '@mikro-orm/core';
import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import { v7 as uuidv7 } from 'uuid';

/**
 * Entity gốc cho mọi bảng nghiệp vụ (ARCHITECTURE §4.4, §6).
 *
 * - `id`: uuid v7 sinh ở ứng dụng, không phụ thuộc cơ chế sinh khóa của CSDL
 *   (Postgres: kiểu `uuid`; MySQL: `char(36)`). v7 có tiền tố thời gian ⇒ chỉ mục B-tree ít phân mảnh.
 * - `createdAt`/`updatedAt`: UTC (`forceUtcTimezone` mặc định bật), độ chính xác mili giây.
 * - `version`: khóa lạc quan (SRS §4.4). MikroORM tự tăng khi `flush()` và ném `OptimisticLockError`
 *   nếu bản ghi đã bị sửa; tầng API đổi lỗi này thành `STALE_VERSION` (409).
 *
 * Kiểu cột khai báo tường minh (`type`) để không phụ thuộc `emitDecoratorMetadata`, nhờ đó
 * entity nạp được bởi mọi bộ nạp TypeScript (SWC, tsdown, vitest) và chỉ dùng kiểu di động.
 */
@Entity({ abstract: true })
export abstract class BaseEntity {
  @PrimaryKey({ type: 'uuid' })
  id: string = uuidv7();

  @Property({ type: 'datetime', length: 3 })
  createdAt: Opt<Date> = new Date();

  @Property({ type: 'datetime', length: 3, onUpdate: () => new Date() })
  updatedAt: Opt<Date> = new Date();

  @Property({ type: 'integer', version: true })
  version!: Opt<number>;
}
