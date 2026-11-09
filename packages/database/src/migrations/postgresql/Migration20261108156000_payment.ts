import { Migration } from '@mikro-orm/migrations';

export class Migration20261108156000_payment extends Migration {

  override name = 'Migration20261108156000_payment';

  override up(): void | Promise<void> {
    this.addSql(`create table "payment" ("id" uuid not null, "created_at" timestamptz(3) not null, "updated_at" timestamptz(3) not null, "version" int not null default 1, "order_id" uuid not null, "kind" varchar(20) not null, "method" varchar(20) not null, "provider" varchar(20) null, "amount_vnd" bigint not null, "reference_code" varchar(40) not null, "provider_txn_id" varchar(100) null, "status" varchar(20) not null default 'PENDING', "expires_at" timestamptz(3) null, "paid_at" timestamptz(3) null, "raw_last_event" jsonb null, "checkout" jsonb null, "recorded_by" uuid null, "note" varchar(500) null, "refunded_at" timestamptz(3) null, "refunded_by" uuid null, "refund_reason" varchar(500) null, primary key ("id"));`);
    this.addSql(`create index "payment_order_id_kind_status_index" on "payment" ("order_id", "kind", "status");`);
    this.addSql(`create index "payment_status_expires_at_index" on "payment" ("status", "expires_at");`);
    this.addSql(`create index "payment_created_at_index" on "payment" ("created_at");`);
    this.addSql(`alter table "payment" add constraint "payment_reference_code_unique" unique ("reference_code");`);
    this.addSql(`alter table "payment" add constraint "payment_provider_provider_txn_id_unique" unique ("provider", "provider_txn_id");`);

    this.addSql(`alter table "payment" add constraint "payment_order_id_foreign" foreign key ("order_id") references "quotation_request" ("id");`);
    this.addSql(`alter table "payment" enable row level security;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "payment" cascade;`);
  }

}
