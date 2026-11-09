/** FR-CAT-07 (GH#254): products a signed-in user saved to their favourites. */
import { Migration } from '@mikro-orm/migrations';

export class Migration20261109100002_product_favourite extends Migration {

  override name = 'Migration20261109100002_product_favourite';

  override up(): void | Promise<void> {
    this.addSql(`create table "product_favourite" ("id" uuid not null, "created_at" timestamptz(3) not null, "updated_at" timestamptz(3) not null, "version" int not null default 1, "user_id" uuid not null, "product_id" uuid not null, primary key ("id"));`);
    this.addSql(`create index "product_favourite_product_id_index" on "product_favourite" ("product_id");`);
    this.addSql(`alter table "product_favourite" add constraint "product_favourite_user_id_product_id_unique" unique ("user_id", "product_id");`);
    this.addSql(`alter table "product_favourite" add constraint "product_favourite_product_id_foreign" foreign key ("product_id") references "product" ("id");`);

    this.addSql(`alter table "product_favourite" enable row level security;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "product_favourite" cascade;`);
  }

}
