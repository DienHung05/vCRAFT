import { Migration } from '@mikro-orm/migrations';

export class Migration20261030070924_quotation_notice_inbox extends Migration {

  override name = 'Migration20261030070924_quotation_notice_inbox';

  override up(): void | Promise<void> {
    this.addSql(`alter table \`quotation_notice\` add \`read_at\` datetime(3) null;`);
    this.addSql(`alter table \`quotation_notice\` modify \`quotation_id\` varchar(36) null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table \`quotation_notice\` drop column \`read_at\`;`);
    this.addSql(`alter table \`quotation_notice\` modify \`quotation_id\` varchar(36) not null;`);
  }

}
