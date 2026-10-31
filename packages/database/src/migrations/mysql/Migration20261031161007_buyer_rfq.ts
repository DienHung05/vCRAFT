import { Migration } from '@mikro-orm/migrations';

export class Migration20261031161007_buyer_rfq extends Migration {

  override name = 'Migration20261031161007_buyer_rfq';

  override up(): void | Promise<void> {
    this.addSql(`alter table \`quotation_request\` add \`title\` varchar(200) null, add \`category\` varchar(20) null, add \`budget_min_vnd\` bigint null, add \`budget_max_vnd\` bigint null, add \`cancel_reason\` varchar(500) null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table \`quotation_request\` drop column \`title\`, drop column \`category\`, drop column \`budget_min_vnd\`, drop column \`budget_max_vnd\`, drop column \`cancel_reason\`;`);
  }

}
