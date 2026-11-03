import { Migration } from '@mikro-orm/migrations';

export class Migration20261103090001_slug_redirect extends Migration {

  override name = 'Migration20261103090001_slug_redirect';

  override up(): void | Promise<void> {
    this.addSql(`create table \`slug_redirect\` (\`id\` varchar(36) not null, \`created_at\` datetime(3) not null, \`updated_at\` datetime(3) not null, \`version\` int not null default 1, \`kind\` varchar(20) not null, \`old_slug\` varchar(200) not null, \`target_id\` varchar(36) not null, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`slug_redirect\` add index \`slug_redirect_target_id_index\` (\`target_id\`);`);
    this.addSql(`alter table \`slug_redirect\` add unique \`slug_redirect_kind_old_slug_unique\` (\`kind\`, \`old_slug\`);`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists \`slug_redirect\`;`);
  }

}
