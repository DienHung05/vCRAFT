import { Migration } from '@mikro-orm/migrations';

export class Migration20261031133953_notifications extends Migration {

  override name = 'Migration20261031133953_notifications';

  override up(): void | Promise<void> {
    this.addSql(`create table "notification" ("id" uuid not null, "created_at" timestamptz(3) not null, "updated_at" timestamptz(3) not null, "version" int not null default 1, "recipient_id" uuid not null, "type" varchar(40) not null, "subject_id" uuid null, "read_at" timestamptz(3) null, primary key ("id"));`);
    this.addSql(`create index "notification_recipient_id_created_at_index" on "notification" ("recipient_id", "created_at");`);

    this.addSql(`create table "notification_preference" ("id" uuid not null, "created_at" timestamptz(3) not null, "updated_at" timestamptz(3) not null, "version" int not null default 1, "user_id" uuid not null, "type" varchar(40) not null, "email_enabled" boolean not null default true, primary key ("id"));`);
    this.addSql(`alter table "notification_preference" add constraint "notification_preference_user_id_type_unique" unique ("user_id", "type");`);

    this.addSql(`alter table "notification" enable row level security;`);

    this.addSql(`alter table "notification_preference" enable row level security;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "notification" cascade;`);
    this.addSql(`drop table if exists "notification_preference" cascade;`);
  }

}
