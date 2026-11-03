import { Migration } from '@mikro-orm/migrations';

export class Migration20261103140000_news_data extends Migration {

  override name = 'Migration20261103140000_news_data';

  override up(): void | Promise<void> {
    this.addSql(`alter table "news" add "data" jsonb null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "news" drop column "data";`);
  }

}
