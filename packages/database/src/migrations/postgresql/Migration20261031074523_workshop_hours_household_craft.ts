import { Migration } from '@mikro-orm/migrations';

export class Migration20261031074523_workshop_hours_household_craft extends Migration {

  override name = 'Migration20261031074523_workshop_hours_household_craft';

  override up(): void | Promise<void> {
    this.addSql(`alter table "household" add "craft" varchar(160) null, add "cover_url" varchar(500) null;`);

    this.addSql(`alter table "workshop" add "opening_hours" jsonb null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "household" drop column "craft", drop column "cover_url";`);

    this.addSql(`alter table "workshop" drop column "opening_hours";`);
  }

}
