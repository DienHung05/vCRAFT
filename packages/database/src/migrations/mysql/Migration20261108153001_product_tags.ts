/** FR-PRD-01 (GH#253): free-text product tags; the `SOLD` status needs no schema change (varchar). */
import { Migration } from '@mikro-orm/migrations';

export class Migration20261108153001_product_tags extends Migration {

  override name = 'Migration20261108153001_product_tags';

  override up(): void | Promise<void> {
    this.addSql(`alter table \`product\` add column \`tags\` json null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table \`product\` drop column \`tags\`;`);
  }

}
