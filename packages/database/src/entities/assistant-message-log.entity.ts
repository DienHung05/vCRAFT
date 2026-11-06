import { type Opt } from '@mikro-orm/core';
import { Entity, Index, Property } from '@mikro-orm/decorators/legacy';
import { BaseEntity } from './base.entity.js';

/**
 * One assistant turn, logged anonymously (PLAN E15, FR-AST-08): a salted hash of the IP, never the IP or
 * an account; the question with personal data masked; intent, whether it was blocked and why, latency,
 * tokens and the visitor's thumbs up/down. Rows are deleted after 30 days. The id is the `messageId` the
 * widget sends back with feedback.
 */
@Entity({ tableName: 'assistant_message_log' })
@Index({ properties: ['createdAt'] })
export class AssistantMessageLog extends BaseEntity {
  @Property({ type: 'string', length: 64 })
  ipHash!: string;

  @Property({ type: 'string', length: 5 })
  locale!: string;

  /** The question after PII masking, cut to 300 characters, for the admin's unanswered-questions list. */
  @Property({ type: 'string', length: 300 })
  question!: string;

  @Property({ type: 'string', length: 30 })
  intent!: string;

  @Property({ type: 'boolean' })
  blocked: Opt<boolean> = false;

  @Property({ type: 'string', length: 30, nullable: true })
  blockReason?: string | null;

  /** Whether the answer had any source to cite (an unanswered question has none). */
  @Property({ type: 'boolean' })
  answered: Opt<boolean> = true;

  @Property({ type: 'integer', nullable: true })
  firstTokenMs?: number | null;

  @Property({ type: 'integer' })
  tokens: Opt<number> = 0;

  @Property({ type: 'string', length: 10, nullable: true })
  feedback?: 'UP' | 'DOWN' | null;
}
