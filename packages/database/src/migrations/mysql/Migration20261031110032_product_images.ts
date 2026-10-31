import { Migration } from '@mikro-orm/migrations';

export class Migration20261031110032_product_images extends Migration {

  override name = 'Migration20261031110032_product_images';

  override up(): void | Promise<void> {
    this.addSql(`alter table \`product\` add \`images\` json null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table \`product\` drop column \`images\`;`);
  }

}
