import { Migration } from '@mikro-orm/migrations';

export class Migration20261027075259_init extends Migration {

  override name = 'Migration20261027075259_init';

  override up(): void | Promise<void> {
    this.addSql(`create table "outbox_event" ("id" uuid not null, "created_at" timestamptz(3) not null, "updated_at" timestamptz(3) not null, "version" int not null default 1, "type" varchar(120) not null, "payload" jsonb not null, "status" varchar(20) not null default 'PENDING', "attempts" int not null default 0, "available_at" timestamptz(3) not null, primary key ("id"));`);
    this.addSql(`create index "outbox_event_status_available_at_index" on "outbox_event" ("status", "available_at");`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "outbox_event" cascade;`);
  }

}
