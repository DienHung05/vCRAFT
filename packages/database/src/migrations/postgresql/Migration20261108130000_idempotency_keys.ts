import { Migration } from '@mikro-orm/migrations';

export class Migration20261108130000_idempotency_keys extends Migration {

  override name = 'Migration20261108130000_idempotency_keys';

  override up(): void | Promise<void> {
    this.addSql(`create table "idempotency_keys" ("id" uuid not null, "created_at" timestamptz(3) not null, "updated_at" timestamptz(3) not null, "version" int not null default 1, "actor_id" uuid not null, "route" varchar(200) not null, "idempotency_key" varchar(255) not null, "request_hash" varchar(64) not null, "response_status" int null, "response_body" jsonb null, primary key ("id"));`);
    this.addSql(`create index "idempotency_keys_created_at_index" on "idempotency_keys" ("created_at");`);
    this.addSql(`alter table "idempotency_keys" add constraint "idempotency_keys_actor_id_route_idempotency_key_unique" unique ("actor_id", "route", "idempotency_key");`);

    this.addSql(`alter table "idempotency_keys" enable row level security;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "idempotency_keys" cascade;`);
  }

}
