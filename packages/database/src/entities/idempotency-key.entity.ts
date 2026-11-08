import { Entity, Index, Property, Unique } from '@mikro-orm/decorators/legacy';
import { BaseEntity } from './base.entity.js';

/**
 * One `Idempotency-Key` seen on a state-changing POST (BR-L5, GH#264). The API claims the key by inserting
 * the row before the handler runs, then stores the 2xx response on it, so a repeat with the same body
 * replays that response and a concurrent repeat finds the claim. The key is scoped to the actor and the
 * route (method + path with its params). `responseStatus`/`responseBody` stay null while the first request
 * is in flight. Rows older than 24 h are ignored by the lookup and purged by the worker. `actorId` has no
 * foreign key, like `ConsentRecord`.
 */
@Entity({ tableName: 'idempotency_keys' })
@Unique({ properties: ['actorId', 'route', 'idempotencyKey'] })
@Index({ properties: ['createdAt'] })
export class IdempotencyKey extends BaseEntity {
  @Property({ type: 'uuid' })
  actorId!: string;

  /** `POST /api/v1/rfqs/<id>/submit`: the method plus the request path, without the query string. */
  @Property({ type: 'string', length: 200 })
  route!: string;

  @Property({ type: 'string', length: 255 })
  idempotencyKey!: string;

  /** SHA-256 (hex) of the canonical JSON body. */
  @Property({ type: 'string', length: 64 })
  requestHash!: string;

  @Property({ type: 'integer', nullable: true })
  responseStatus?: number | null;

  @Property({ type: 'json', nullable: true })
  responseBody?: unknown;
}
