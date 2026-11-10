import { Migration } from '@mikro-orm/migrations';

/** GH#428: \`withdrawn_by\` records whether the owner or the board withdrew a product. */
export class Migration20261110120001_product_withdrawn_by extends Migration {

  override name = 'Migration20261110120001_product_withdrawn_by';

  override up(): void | Promise<void> {
    this.addSql(`alter table \`product\` add column \`withdrawn_by\` varchar(10) null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table \`product\` drop column \`withdrawn_by\`;`);
  }

}
