import { Migration } from '@mikro-orm/migrations';

export class Migration20261103160001_assistant_message_log extends Migration {

  override name = 'Migration20261103160001_assistant_message_log';

  override up(): void | Promise<void> {
    this.addSql(`create table \`assistant_message_log\` (\`id\` varchar(36) not null, \`created_at\` datetime(3) not null, \`updated_at\` datetime(3) not null, \`version\` int not null default 1, \`ip_hash\` varchar(64) not null, \`locale\` varchar(5) not null, \`question\` varchar(300) not null, \`intent\` varchar(30) not null, \`blocked\` tinyint(1) not null, \`block_reason\` varchar(30) null, \`answered\` tinyint(1) not null, \`first_token_ms\` int null, \`tokens\` int not null, \`feedback\` varchar(10) null, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`assistant_message_log\` add index \`assistant_message_log_created_at_index\` (\`created_at\`);`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists \`assistant_message_log\`;`);
  }

}
