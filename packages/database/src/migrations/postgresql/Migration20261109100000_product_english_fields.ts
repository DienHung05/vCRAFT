/** FR-CAT-08 (GH#254): optional English name, description, material and dimensions of a product. */
import { Migration } from '@mikro-orm/migrations';

export class Migration20261109100000_product_english_fields extends Migration {

  override name = 'Migration20261109100000_product_english_fields';

  override up(): void | Promise<void> {
    this.addSql(`alter table "product" add column "name_en" varchar(200) null, add column "description_en" text null, add column "material_en" varchar(200) null, add column "dimensions_en" varchar(200) null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "product" drop column "name_en", drop column "description_en", drop column "material_en", drop column "dimensions_en";`);
  }

}
