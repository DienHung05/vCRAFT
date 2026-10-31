import { Migration } from '@mikro-orm/migrations';

export class Migration20261031082128_household_profile extends Migration {

  override name = 'Migration20261031082128_household_profile';

  override up(): void | Promise<void> {
    this.addSql(`alter table "household" add "founded_year" int null, add "generations" int null, add "timeline" jsonb null, add "certifications" jsonb null, add "gallery" jsonb null, add "capacity_by_category" jsonb null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "household" drop column "founded_year", drop column "generations", drop column "timeline", drop column "certifications", drop column "gallery", drop column "capacity_by_category";`);
  }

}
