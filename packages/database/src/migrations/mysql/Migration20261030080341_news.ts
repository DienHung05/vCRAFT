import { Migration } from '@mikro-orm/migrations';

export class Migration20261030080341_news extends Migration {

  override name = 'Migration20261030080341_news';

  override up(): void | Promise<void> {
    this.addSql(`create table \`news\` (\`id\` varchar(36) not null, \`created_at\` datetime(3) not null, \`updated_at\` datetime(3) not null, \`version\` int not null default 1, \`slug\` varchar(200) not null, \`title\` varchar(200) not null, \`summary\` varchar(500) not null, \`body\` text not null, \`category\` varchar(20) not null, \`household_id\` varchar(36) null, \`status\` varchar(20) not null default 'DRAFT', \`published_at\` datetime(3) null, \`pinned\` tinyint(1) not null default false, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`news\` add unique \`news_slug_unique\` (\`slug\`);`);
    this.addSql(`alter table \`news\` add index \`news_household_id_index\` (\`household_id\`);`);
    this.addSql(`alter table \`news\` add index \`news_household_id_status_index\` (\`household_id\`, \`status\`);`);
    this.addSql(`alter table \`news\` add index \`news_status_pinned_published_at_index\` (\`status\`, \`pinned\`, \`published_at\`);`);

    this.addSql(`alter table \`news\` add constraint \`news_household_id_foreign\` foreign key (\`household_id\`) references \`household\` (\`id\`) on delete set null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists \`news\`;`);
  }

}
