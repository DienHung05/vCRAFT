import { Migration } from '@mikro-orm/migrations';

export class Migration20261101075426_household_id_number extends Migration {

  override name = 'Migration20261101075426_household_id_number';

  override up(): void | Promise<void> {
    this.addSql(`alter table "household" add "id_number_enc" varchar(255) null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "household" drop column "id_number_enc";`);
  }

}
