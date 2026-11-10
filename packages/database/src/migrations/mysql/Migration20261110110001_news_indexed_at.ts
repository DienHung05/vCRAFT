import { Migration } from '@mikro-orm/migrations';

/** GH#430: `indexed_at` lets the worker queue scheduled news for the assistant index once it goes live. */
export class Migration20261110110001_news_indexed_at extends Migration {

  override name = 'Migration20261110110001_news_indexed_at';

  override up(): void | Promise<void> {
    this.addSql(`alter table \`news\` add column \`indexed_at\` datetime(3) null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table \`news\` drop column \`indexed_at\`;`);
  }

}
