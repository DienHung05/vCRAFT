import { Entity, Index, Property } from '@mikro-orm/decorators/legacy';
import { BaseEntity } from './base.entity.js';

/** Nhật ký thao tác quản trị (append-only): ai đổi trạng thái gì, từ đâu sang đâu, vì sao. */
@Entity({ tableName: 'audit_log' })
@Index({ properties: ['entity', 'entityId'] })
export class AuditLog extends BaseEntity {
  @Property({ type: 'uuid' })
  actorId!: string;

  @Property({ type: 'string', length: 80 })
  action!: string;

  @Property({ type: 'string', length: 60 })
  entity!: string;

  @Property({ type: 'uuid' })
  entityId!: string;

  @Property({ type: 'json', nullable: true })
  before?: Record<string, unknown> | null;

  @Property({ type: 'json', nullable: true })
  after?: Record<string, unknown> | null;
}
