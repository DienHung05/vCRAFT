import { Migration } from '@mikro-orm/migrations';

export class Migration20261031163249_admin_news extends Migration {

  override name = 'Migration20261031163249_admin_news';

  override up(): void | Promise<void> {
    this.addSql(`alter table \`news\` add \`body_html\` text null, add \`visibility\` varchar(20) not null default 'PUBLIC', add \`important\` tinyint(1) not null default false, add \`notified_at\` datetime(3) null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table \`news\` drop column \`body_html\`, drop column \`visibility\`, drop column \`important\`, drop column \`notified_at\`;`);
  }

}
