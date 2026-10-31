import { Migration } from '@mikro-orm/migrations';

export class Migration20261031080728_catalog_fields extends Migration {

  override name = 'Migration20261031080728_catalog_fields';

  override up(): void | Promise<void> {
    this.addSql(`alter table "household" add "search_text" varchar(600) not null default '';`);

    this.addSql(`alter table "news" add "search_text" varchar(800) not null default '';`);

    this.addSql(`alter table "product" add "category" varchar(20) not null default 'DECOR', add "price_vnd" int not null default 0, add "stock" int not null default 0, add "material" varchar(200) null, add "dimensions" varchar(200) null, add "weight_grams" int null, add "artisan_note" text null, add "cover_url" varchar(500) null, add "cover_alt" varchar(500) null, add "search_text" varchar(700) not null default '';`);
    this.addSql(`create index "product_status_published_at_index" on "product" ("status", "published_at");`);
    this.addSql(`create index "product_status_price_vnd_index" on "product" ("status", "price_vnd");`);
    this.addSql(`create index "product_status_category_index" on "product" ("status", "category");`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "household" drop column "search_text";`);

    this.addSql(`alter table "news" drop column "search_text";`);

    this.addSql(`drop index "product_status_published_at_index";`);
    this.addSql(`drop index "product_status_price_vnd_index";`);
    this.addSql(`drop index "product_status_category_index";`);
    this.addSql(`alter table "product" drop column "category", drop column "price_vnd", drop column "stock", drop column "material", drop column "dimensions", drop column "weight_grams", drop column "artisan_note", drop column "cover_url", drop column "cover_alt", drop column "search_text";`);
  }

}
