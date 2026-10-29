import { Migration } from '@mikro-orm/migrations';

export class Migration20261029092626_household extends Migration {

  override name = 'Migration20261029092626_household';

  override up(): void | Promise<void> {
    this.addSql(`create table "app_user" ("id" uuid not null, "email" varchar(320) not null, "full_name" varchar(160) null, "role" varchar(20) not null, "status" varchar(20) not null default 'ACTIVE', "created_at" timestamptz(3) not null, "updated_at" timestamptz(3) not null, "version" int not null default 1, primary key ("id"));`);
    this.addSql(`alter table "app_user" add constraint "app_user_email_unique" unique ("email");`);

    this.addSql(`create table "audit_log" ("id" uuid not null, "created_at" timestamptz(3) not null, "updated_at" timestamptz(3) not null, "version" int not null default 1, "actor_id" uuid not null, "action" varchar(80) not null, "entity" varchar(60) not null, "entity_id" uuid not null, "before" jsonb null, "after" jsonb null, primary key ("id"));`);
    this.addSql(`create index "audit_log_entity_entity_id_index" on "audit_log" ("entity", "entity_id");`);

    this.addSql(`create table "household" ("id" uuid not null, "created_at" timestamptz(3) not null, "updated_at" timestamptz(3) not null, "version" int not null default 1, "name" varchar(160) not null, "slug" varchar(160) not null, "history" text not null, "village" varchar(160) null, "status" varchar(20) not null default 'PENDING_REVIEW', "status_reason" varchar(500) null, "approved_at" timestamptz(3) null, "representative_id" uuid not null, primary key ("id"));`);
    this.addSql(`alter table "household" add constraint "household_slug_unique" unique ("slug");`);
    this.addSql(`alter table "household" add constraint "household_representative_id_unique" unique ("representative_id");`);
    this.addSql(`create index "household_status_index" on "household" ("status");`);

    this.addSql(`create table "artisan" ("id" uuid not null, "created_at" timestamptz(3) not null, "updated_at" timestamptz(3) not null, "version" int not null default 1, "household_id" uuid not null, "name" varchar(160) not null, "craft_role" varchar(160) null, "bio" text null, primary key ("id"));`);

    this.addSql(`create table "product" ("id" uuid not null, "created_at" timestamptz(3) not null, "updated_at" timestamptz(3) not null, "version" int not null default 1, "household_id" uuid not null, "name" varchar(200) not null, "slug" varchar(200) not null, "trace_code" varchar(16) not null, "description" text not null, "kind" varchar(10) not null default 'OBJECT', "batch_size" int null, "status" varchar(20) not null default 'DRAFT', "published_at" timestamptz(3) null, "withdrawn_reason" varchar(500) null, primary key ("id"));`);
    this.addSql(`alter table "product" add constraint "product_slug_unique" unique ("slug");`);
    this.addSql(`alter table "product" add constraint "product_trace_code_unique" unique ("trace_code");`);
    this.addSql(`create index "product_household_id_status_index" on "product" ("household_id", "status");`);

    this.addSql(`create table "workshop" ("id" uuid not null, "created_at" timestamptz(3) not null, "updated_at" timestamptz(3) not null, "version" int not null default 1, "household_id" uuid not null, "name" varchar(160) not null, "address" varchar(300) not null, "purpose" varchar(20) not null default 'PRODUCTION', "accepts_visitors" boolean not null default false, "visiting_info" text null, "lat" numeric(9,6) null, "lng" numeric(9,6) null, primary key ("id"));`);
    this.addSql(`create index "workshop_lat_lng_index" on "workshop" ("lat", "lng");`);

    this.addSql(`alter table "app_user" enable row level security;`);

    this.addSql(`alter table "audit_log" enable row level security;`);

    this.addSql(`alter table "household" add constraint "household_representative_id_foreign" foreign key ("representative_id") references "app_user" ("id");`);
    this.addSql(`alter table "household" enable row level security;`);

    this.addSql(`alter table "artisan" add constraint "artisan_household_id_foreign" foreign key ("household_id") references "household" ("id");`);
    this.addSql(`alter table "artisan" enable row level security;`);

    this.addSql(`alter table "product" add constraint "product_household_id_foreign" foreign key ("household_id") references "household" ("id");`);
    this.addSql(`alter table "product" enable row level security;`);

    this.addSql(`alter table "workshop" add constraint "workshop_household_id_foreign" foreign key ("household_id") references "household" ("id");`);
    this.addSql(`alter table "workshop" enable row level security;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "household" drop constraint "household_representative_id_foreign";`);
    this.addSql(`alter table "artisan" drop constraint "artisan_household_id_foreign";`);
    this.addSql(`alter table "product" drop constraint "product_household_id_foreign";`);
    this.addSql(`alter table "workshop" drop constraint "workshop_household_id_foreign";`);

    this.addSql(`drop table if exists "app_user" cascade;`);
    this.addSql(`drop table if exists "audit_log" cascade;`);
    this.addSql(`drop table if exists "household" cascade;`);
    this.addSql(`drop table if exists "artisan" cascade;`);
    this.addSql(`drop table if exists "product" cascade;`);
    this.addSql(`drop table if exists "workshop" cascade;`);
  }

}
