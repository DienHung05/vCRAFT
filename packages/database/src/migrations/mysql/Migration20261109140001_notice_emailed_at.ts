import { Migration } from '@mikro-orm/migrations';

/** GH#377: `emailed_at` records that the notice mail was claimed, so a re-run does not email twice. */
export class Migration20261109140001_notice_emailed_at extends Migration {

  override name = 'Migration20261109140001_notice_emailed_at';

  override up(): void | Promise<void> {
    this.addSql(`alter table \`quotation_notice\` add column \`emailed_at\` datetime(3) null;`);
    this.addSql(`alter table \`notification\` add column \`emailed_at\` datetime(3) null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table \`notification\` drop column \`emailed_at\`;`);
    this.addSql(`alter table \`quotation_notice\` drop column \`emailed_at\`;`);
  }

}
