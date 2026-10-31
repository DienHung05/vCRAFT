import { Migration } from '@mikro-orm/migrations';

export class Migration20261031112834_trace_scan extends Migration {

  override name = 'Migration20261031112834_trace_scan';

  override up(): void | Promise<void> {
    this.addSql(`create table "trace_scan" ("id" uuid not null, "created_at" timestamptz(3) not null, "updated_at" timestamptz(3) not null, "version" int not null default 1, "product_id" uuid not null, primary key ("id"));`);
    this.addSql(`create index "trace_scan_created_at_index" on "trace_scan" ("created_at");`);

    this.addSql(`alter table "trace_scan" add constraint "trace_scan_product_id_foreign" foreign key ("product_id") references "product" ("id") on delete cascade;`);
    this.addSql(`alter table "trace_scan" enable row level security;`);
    this.addSql(`alter table "trace_scan" enable row level security;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "trace_scan" cascade;`);
  }

}
