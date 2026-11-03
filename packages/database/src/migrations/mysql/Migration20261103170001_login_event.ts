import { Migration } from '@mikro-orm/migrations';

export class Migration20261103170001_login_event extends Migration {

  override name = 'Migration20261103170001_login_event';

  override up(): void | Promise<void> {
    this.addSql(`create table \`login_event\` (\`id\` varchar(36) not null, \`created_at\` datetime(3) not null, \`updated_at\` datetime(3) not null, \`version\` int not null default 1, \`user_id\` varchar(36) not null, \`session_id\` varchar(64) not null, \`method\` varchar(20) not null, \`aal\` varchar(4) not null, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`login_event\` add index \`login_event_user_id_created_at_index\` (\`user_id\`, \`created_at\`);`);
    this.addSql(`alter table \`login_event\` add unique \`login_event_session_id_unique\` (\`session_id\`);`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists \`login_event\`;`);
  }

}
