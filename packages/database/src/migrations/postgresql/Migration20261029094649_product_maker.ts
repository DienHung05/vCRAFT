import { Migration } from '@mikro-orm/migrations';

export class Migration20261029094649_product_maker extends Migration {

  override name = 'Migration20261029094649_product_maker';

  override up(): void | Promise<void> {
    this.addSql(`create table "product_maker" ("id" uuid not null, "created_at" timestamptz(3) not null, "updated_at" timestamptz(3) not null, "version" int not null default 1, "product_id" uuid not null, "artisan_id" uuid not null, "contribution" varchar(160) not null, "position" int not null, primary key ("id"));`);
    this.addSql(`alter table "product_maker" add constraint "product_maker_product_id_artisan_id_unique" unique ("product_id", "artisan_id");`);

    this.addSql(`alter table "product_maker" add constraint "product_maker_product_id_foreign" foreign key ("product_id") references "product" ("id");`);
    this.addSql(`alter table "product_maker" add constraint "product_maker_artisan_id_foreign" foreign key ("artisan_id") references "artisan" ("id");`);
    this.addSql(`alter table "product_maker" enable row level security;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "product_maker" cascade;`);
  }

}
