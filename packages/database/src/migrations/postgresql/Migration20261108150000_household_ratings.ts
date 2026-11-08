import { Migration } from '@mikro-orm/migrations';

/** GH#248 s5-11 (FR-ORD-11): the buyer's 1-5 star rating of each household after delivery. */
export class Migration20261108150000_household_ratings extends Migration {

  override name = 'Migration20261108150000_household_ratings';

  override up(): void | Promise<void> {
    this.addSql(`create table "household_ratings" ("id" uuid not null, "created_at" timestamptz(3) not null, "updated_at" timestamptz(3) not null, "version" int not null default 1, "request_id" uuid not null, "household_id" uuid not null, "rater_id" uuid not null, "stars" int not null, "comment" varchar(1000) null, primary key ("id"));`);
    this.addSql(`create index "household_ratings_household_id_index" on "household_ratings" ("household_id");`);
    this.addSql(`alter table "household_ratings" add constraint "household_ratings_request_id_household_id_unique" unique ("request_id", "household_id");`);

    this.addSql(`alter table "household_ratings" add constraint "household_ratings_request_id_foreign" foreign key ("request_id") references "quotation_request" ("id");`);
    this.addSql(`alter table "household_ratings" add constraint "household_ratings_household_id_foreign" foreign key ("household_id") references "household" ("id");`);
    this.addSql(`alter table "household_ratings" enable row level security;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "household_ratings" cascade;`);
  }

}
