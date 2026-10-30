import { Migration } from '@mikro-orm/migrations';

export class Migration20261030070922_quotation_notice_inbox extends Migration {

  override name = 'Migration20261030070922_quotation_notice_inbox';

  override up(): void | Promise<void> {
    this.addSql(`alter table "quotation_notice" add "read_at" timestamptz(3) null;`);
    this.addSql(`alter table "quotation_notice" alter column "quotation_id" drop not null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "quotation_notice" drop column "read_at";`);
    this.addSql(`alter table "quotation_notice" alter column "quotation_id" set not null;`);
  }

}
