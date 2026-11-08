/** GH#314: source (publisher, link, original date) and admin-only origin of a news item. */
import { Migration } from '@mikro-orm/migrations';

export class Migration20261109120001_news_source extends Migration {

  override name = 'Migration20261109120001_news_source';

  override up(): void | Promise<void> {
    this.addSql(`alter table \`news\` add column \`source_name\` varchar(120) null, add column \`source_url\` varchar(500) null, add column \`source_published_at\` datetime(3) null, add column \`origin\` varchar(20) not null default 'MANUAL';`);
    this.addSql(`alter table \`news\` add index \`news_origin_status_published_at_index\` (\`origin\`, \`status\`, \`published_at\`);`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table \`news\` drop index \`news_origin_status_published_at_index\`;`);
    this.addSql(`alter table \`news\` drop column \`source_name\`, drop column \`source_url\`, drop column \`source_published_at\`, drop column \`origin\`;`);
  }

}
