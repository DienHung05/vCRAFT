import { Migration } from '@mikro-orm/migrations';

/**
 * GH#243: custom requirements on a quotation request (FR-RFQ-01) and the free note a household can add to
 * its own quotation. Request attachments are `media_link` rows, so they need no column.
 */
export class Migration20261108100001_rfq_requirements_direct_quote extends Migration {

  override name = 'Migration20261108100001_rfq_requirements_direct_quote';

  override up(): void | Promise<void> {
    this.addSql(`alter table \`quotation_request\` add \`custom_requirements\` text null;`);
    this.addSql(`alter table \`cooperative_quotation\` add \`note\` varchar(500) null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table \`quotation_request\` drop column \`custom_requirements\`;`);
    this.addSql(`alter table \`cooperative_quotation\` drop column \`note\`;`);
  }

}
