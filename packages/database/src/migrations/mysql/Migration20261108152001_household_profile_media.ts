import { Migration } from '@mikro-orm/migrations';

/**
 * GH#253 (FR-ART-01): cover photo, portrait and personal seal of the household as media references
 * (`{ mediaId, alt }`), plus the craft category picked from a fixed list. `craft` stays as free-text detail.
 */
export class Migration20261108152001_household_profile_media extends Migration {

  override name = 'Migration20261108152001_household_profile_media';

  override up(): void | Promise<void> {
    this.addSql(`alter table \`household\` add \`craft_category\` varchar(20) null, add \`cover_photo\` json null, add \`portrait_photo\` json null, add \`seal_photo\` json null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table \`household\` drop column \`craft_category\`, drop column \`cover_photo\`, drop column \`portrait_photo\`, drop column \`seal_photo\`;`);
  }

}
