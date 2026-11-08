/** vCRAFT-8my.2 explicit applicant resubmission marker. */
import { Migration } from '@mikro-orm/migrations';

export class Migration20261108120000_household_resubmission extends Migration {

  override name = 'Migration20261108120000_household_resubmission';

  override up(): void | Promise<void> {
    this.addSql(`alter table "household" add column "resubmitted_at" timestamptz(3) null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "household" drop column "resubmitted_at";`);
  }

}
