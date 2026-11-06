import { Migration } from '@mikro-orm/migrations';

export class Migration20261103090000_slug_redirect extends Migration {

  override name = 'Migration20261103090000_slug_redirect';

  override up(): void | Promise<void> {
    this.addSql(`create table "slug_redirect" ("id" uuid not null, "created_at" timestamptz(3) not null, "updated_at" timestamptz(3) not null, "version" int not null default 1, "kind" varchar(20) not null, "old_slug" varchar(200) not null, "target_id" uuid not null, primary key ("id"));`);
    this.addSql(`create index "slug_redirect_target_id_index" on "slug_redirect" ("target_id");`);
    this.addSql(`alter table "slug_redirect" add constraint "slug_redirect_kind_old_slug_unique" unique ("kind", "old_slug");`);

    this.addSql(`alter table "slug_redirect" enable row level security;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "slug_redirect" cascade;`);
  }

}
