import { Migration } from '@mikro-orm/migrations';

export class Migration20261103160000_assistant_message_log extends Migration {

  override name = 'Migration20261103160000_assistant_message_log';

  override up(): void | Promise<void> {
    this.addSql(`create table "assistant_message_log" ("id" uuid not null, "created_at" timestamptz(3) not null, "updated_at" timestamptz(3) not null, "version" int not null default 1, "ip_hash" varchar(64) not null, "locale" varchar(5) not null, "question" varchar(300) not null, "intent" varchar(30) not null, "blocked" boolean not null default false, "block_reason" varchar(30) null, "answered" boolean not null default true, "first_token_ms" int null, "tokens" int not null default 0, "feedback" varchar(10) null, primary key ("id"));`);
    this.addSql(`create index "assistant_message_log_created_at_index" on "assistant_message_log" ("created_at");`);

    this.addSql(`alter table "assistant_message_log" enable row level security;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "assistant_message_log" cascade;`);
  }

}
