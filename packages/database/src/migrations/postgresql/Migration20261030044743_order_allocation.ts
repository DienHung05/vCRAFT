import { Migration } from '@mikro-orm/migrations';

export class Migration20261030044743_order_allocation extends Migration {

  override name = 'Migration20261030044743_order_allocation';

  override up(): void | Promise<void> {
    this.addSql(`create table "order_allocation" ("id" uuid not null, "created_at" timestamptz(3) not null, "updated_at" timestamptz(3) not null, "version" int not null default 1, "quotation_id" uuid not null, "household_id" uuid not null, "quantity" int not null, "completed_qty" int not null default 0, "status" varchar(20) not null default 'PROPOSED', primary key ("id"));`);
    this.addSql(`create index "order_allocation_quotation_id_status_index" on "order_allocation" ("quotation_id", "status");`);

    this.addSql(`alter table "order_allocation" add constraint "order_allocation_quotation_id_foreign" foreign key ("quotation_id") references "cooperative_quotation" ("id");`);
    this.addSql(`alter table "order_allocation" add constraint "order_allocation_household_id_foreign" foreign key ("household_id") references "household" ("id");`);
    this.addSql(`alter table "order_allocation" enable row level security;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "order_allocation" cascade;`);
  }

}
