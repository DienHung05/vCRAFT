import { Migration } from '@mikro-orm/migrations';

export class Migration20261031162028_studio_quotations extends Migration {

  override name = 'Migration20261031162028_studio_quotations';

  override up(): void | Promise<void> {
    this.addSql(`alter table \`quotation_request\` add \`declined_household_ids\` json null;`);

    this.addSql(`alter table \`order_allocation\` add \`progress_log\` json null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table \`order_allocation\` drop column \`progress_log\`;`);

    this.addSql(`alter table \`quotation_request\` drop column \`declined_household_ids\`;`);
  }

}
