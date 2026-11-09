import { Migration } from '@mikro-orm/migrations';

/** GH#248 s5-10 (FR-ORD-10): the off-platform customer an administrator made a request for. */
export class Migration20261108150002_rfq_on_behalf extends Migration {

  override name = 'Migration20261108150002_rfq_on_behalf';

  override up(): void | Promise<void> {
    this.addSql(`alter table "quotation_request" add column "on_behalf_name" varchar(120) null, add column "on_behalf_phone" varchar(20) null, add column "on_behalf_email" varchar(254) null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "quotation_request" drop column "on_behalf_name", drop column "on_behalf_phone", drop column "on_behalf_email";`);
  }

}
