import { Migration } from '@mikro-orm/migrations';

/** GH#418: `withdrawn_at` records that the person withdrew the consent; the row stays as history. */
export class Migration20261110090001_consent_withdrawn_at extends Migration {

  override name = 'Migration20261110090001_consent_withdrawn_at';

  override up(): void | Promise<void> {
    this.addSql(`alter table \`consent_record\` add column \`withdrawn_at\` datetime(3) null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table \`consent_record\` drop column \`withdrawn_at\`;`);
  }

}
