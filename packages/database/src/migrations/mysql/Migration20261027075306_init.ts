import { Migration } from '@mikro-orm/migrations';

export class Migration20261027075306_init extends Migration {

  override name = 'Migration20261027075306_init';

  override up(): void | Promise<void> {
    this.addSql(`create table \`outbox_event\` (\`id\` varchar(36) not null, \`created_at\` datetime(3) not null, \`updated_at\` datetime(3) not null, \`version\` int not null default 1, \`type\` varchar(120) not null, \`payload\` json not null, \`status\` varchar(20) not null default 'PENDING', \`attempts\` int not null default 0, \`available_at\` datetime(3) not null, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`outbox_event\` add index \`outbox_event_status_available_at_index\` (\`status\`, \`available_at\`);`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists \`outbox_event\`;`);
  }

}
