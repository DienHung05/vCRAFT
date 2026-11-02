import { Migration } from '@mikro-orm/migrations';

export class Migration20261101150001_alt_en extends Migration {

  override name = 'Migration20261101150001_alt_en';

  override up(): void | Promise<void> {
    this.addSql(`alter table \`media_link\` add \`alt_en\` varchar(500) null;`);
    this.addSql(`alter table \`product\` add \`cover_alt_en\` varchar(500) null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table \`media_link\` drop column \`alt_en\`;`);
    this.addSql(`alter table \`product\` drop column \`cover_alt_en\`;`);
  }

}
