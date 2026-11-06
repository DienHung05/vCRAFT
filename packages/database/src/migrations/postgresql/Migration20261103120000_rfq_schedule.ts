import { Migration } from '@mikro-orm/migrations';

export class Migration20261103120000_rfq_schedule extends Migration {

  override name = 'Migration20261103120000_rfq_schedule';

  override up(): void | Promise<void> {
    this.addSql(`alter table "quotation_request" add "bidding_closed_at" timestamptz(3) null, add "coordination_flagged_at" timestamptz(3) null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "quotation_request" drop column "bidding_closed_at", drop column "coordination_flagged_at";`);
  }

}
