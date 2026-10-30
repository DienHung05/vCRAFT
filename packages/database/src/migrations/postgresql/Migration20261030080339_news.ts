import { Migration } from '@mikro-orm/migrations';

export class Migration20261030080339_news extends Migration {

  override name = 'Migration20261030080339_news';

  override up(): void | Promise<void> {
    this.addSql(`create table "news" ("id" uuid not null, "created_at" timestamptz(3) not null, "updated_at" timestamptz(3) not null, "version" int not null default 1, "slug" varchar(200) not null, "title" varchar(200) not null, "summary" varchar(500) not null, "body" text not null, "category" varchar(20) not null, "household_id" uuid null, "status" varchar(20) not null default 'DRAFT', "published_at" timestamptz(3) null, "pinned" boolean not null default false, primary key ("id"));`);
    this.addSql(`alter table "news" add constraint "news_slug_unique" unique ("slug");`);
    this.addSql(`create index "news_household_id_status_index" on "news" ("household_id", "status");`);
    this.addSql(`create index "news_status_pinned_published_at_index" on "news" ("status", "pinned", "published_at");`);

    this.addSql(`alter table "news" add constraint "news_household_id_foreign" foreign key ("household_id") references "household" ("id") on delete set null;`);
    this.addSql(`alter table "news" enable row level security;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "news" cascade;`);
  }

}
