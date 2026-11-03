import { Migration } from '@mikro-orm/migrations';

export class Migration20261103170000_login_event extends Migration {

  override name = 'Migration20261103170000_login_event';

  override up(): void | Promise<void> {
    this.addSql(`create table "login_event" ("id" uuid not null, "created_at" timestamptz(3) not null, "updated_at" timestamptz(3) not null, "version" int not null default 1, "user_id" uuid not null, "session_id" varchar(64) not null, "method" varchar(20) not null, "aal" varchar(4) not null, primary key ("id"));`);
    this.addSql(`create index "login_event_user_id_created_at_index" on "login_event" ("user_id", "created_at");`);
    this.addSql(`alter table "login_event" add constraint "login_event_session_id_unique" unique ("session_id");`);

    this.addSql(`alter table "login_event" enable row level security;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "login_event" cascade;`);
  }

}
