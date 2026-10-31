import { Migration } from '@mikro-orm/migrations';

export class Migration20261031074515_media_link extends Migration {

  override name = 'Migration20261031074515_media_link';

  override up(): void | Promise<void> {
    this.addSql(`create table "media_link" ("id" uuid not null, "created_at" timestamptz(3) not null, "updated_at" timestamptz(3) not null, "version" int not null default 1, "media_id" uuid not null, "target_type" varchar(20) not null, "target_id" uuid not null, "role" varchar(20) not null, "position" int not null default 0, "alt_text" varchar(500) null, "caption" varchar(300) null, primary key ("id"));`);
    this.addSql(`create index "media_link_target_type_target_id_index" on "media_link" ("target_type", "target_id");`);
    this.addSql(`alter table "media_link" add constraint "media_link_target_type_target_id_role_position_unique" unique ("target_type", "target_id", "role", "position");`);

    this.addSql(`alter table "media_asset" add "alt_text" varchar(500) null, add "credit" jsonb null;`);

    this.addSql(`alter table "media_link" add constraint "media_link_media_id_foreign" foreign key ("media_id") references "media_asset" ("id");`);
    this.addSql(`alter table "media_link" enable row level security;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "media_link" cascade;`);

    this.addSql(`alter table "media_asset" drop column "alt_text", drop column "credit";`);
  }

}
