/** GH#294 workshop hamlet used to target outage notices (ADR-0023). */
import { Migration } from '@mikro-orm/migrations';

export class Migration20261108155000_workshop_area_code extends Migration {

  override name = 'Migration20261108155000_workshop_area_code';

  override up(): void | Promise<void> {
    this.addSql(`alter table "workshop" add column "area_code" varchar(20) null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "workshop" drop column "area_code";`);
  }

}
