import { Migration } from '@mikro-orm/migrations';

export class Migration20261029120000_quotation extends Migration {
  override name = 'Migration20261029120000_quotation';

  override up(): void | Promise<void> {
    this.addSql(`create table "quotation_notice" ("id" uuid not null, "created_at" timestamptz(3) not null, "updated_at" timestamptz(3) not null, "version" int not null default 1, "recipient_id" uuid not null, "request_id" uuid not null, "quotation_id" uuid not null, "kind" varchar(40) not null default 'QUOTATION_WITHDRAWN', primary key ("id"));`);
    this.addSql(`create index "quotation_notice_recipient_id_created_at_index" on "quotation_notice" ("recipient_id", "created_at");`);
    this.addSql(`alter table "quotation_notice" enable row level security;`);
    this.addSql(`create table "quotation_request" ("id" uuid not null, "created_at" timestamptz(3) not null, "updated_at" timestamptz(3) not null, "version" int not null default 1, "buyer_id" uuid not null, "coordinator_id" uuid null, "revision" int not null default 0, "design" varchar(500) not null, "quantity" int not null, "unit" varchar(30) not null, "destination" varchar(300) not null, "required_by" timestamptz(3) not null, "bidding_closes_at" timestamptz(3) not null, "invited_household_ids" jsonb not null, "coordination_opt_in" boolean not null default false, "status" varchar(20) not null default 'DRAFT', primary key ("id"));`);
    this.addSql(`create index "quotation_request_buyer_id_status_index" on "quotation_request" ("buyer_id", "status");`);
    this.addSql(`alter table "quotation_request" add constraint "quotation_request_buyer_id_foreign" foreign key ("buyer_id") references "app_user" ("id");`);
    this.addSql(`alter table "quotation_request" enable row level security;`);

    this.addSql(`create table "contribution_offer" ("id" uuid not null, "created_at" timestamptz(3) not null, "updated_at" timestamptz(3) not null, "version" int not null default 1, "request_id" uuid not null, "household_id" uuid not null, "max_quantity" int not null, "unit_price_vnd" bigint not null, "completion_date" timestamptz(3) not null, "status" varchar(20) not null default 'ACTIVE', "history" jsonb not null, primary key ("id"));`);
    this.addSql(`create index "contribution_offer_request_id_status_index" on "contribution_offer" ("request_id", "status");`);
    this.addSql(`alter table "contribution_offer" add constraint "contribution_offer_request_id_household_id_unique" unique ("request_id", "household_id");`);
    this.addSql(`alter table "contribution_offer" add constraint "contribution_offer_request_id_foreign" foreign key ("request_id") references "quotation_request" ("id");`);
    this.addSql(`alter table "contribution_offer" add constraint "contribution_offer_household_id_foreign" foreign key ("household_id") references "household" ("id");`);
    this.addSql(`alter table "contribution_offer" enable row level security;`);

    this.addSql(`create table "cooperative_quotation" ("id" uuid not null, "created_at" timestamptz(3) not null, "updated_at" timestamptz(3) not null, "version" int not null default 1, "request_id" uuid not null, "status" varchar(20) not null default 'SUBMITTED', "quantity" int not null, "parts" jsonb not null, "production_total_vnd" bigint not null, "additional_charge_vnd" bigint not null default '0', "total_vnd" bigint not null, "delivery_terms" varchar(20) not null, "bid_type" varchar(20) not null default 'COOPERATIVE', primary key ("id"));`);
    this.addSql(`create index "cooperative_quotation_request_id_status_index" on "cooperative_quotation" ("request_id", "status");`);
    this.addSql(`alter table "cooperative_quotation" add constraint "cooperative_quotation_request_id_foreign" foreign key ("request_id") references "quotation_request" ("id");`);
    this.addSql(`alter table "cooperative_quotation" enable row level security;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "quotation_notice" cascade;`);
    this.addSql(`drop table if exists "cooperative_quotation" cascade;`);
    this.addSql(`drop table if exists "contribution_offer" cascade;`);
    this.addSql(`drop table if exists "quotation_request" cascade;`);
  }
}
