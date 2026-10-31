import { Migration } from '@mikro-orm/migrations';

export class Migration20261031133958_notifications extends Migration {

  override name = 'Migration20261031133958_notifications';

  override up(): void | Promise<void> {
    this.addSql(`create table \`notification\` (\`id\` varchar(36) not null, \`created_at\` datetime(3) not null, \`updated_at\` datetime(3) not null, \`version\` int not null default 1, \`recipient_id\` varchar(36) not null, \`type\` varchar(40) not null, \`subject_id\` varchar(36) null, \`read_at\` datetime(3) null, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`notification\` add index \`notification_recipient_id_created_at_index\` (\`recipient_id\`, \`created_at\`);`);

    this.addSql(`create table \`notification_preference\` (\`id\` varchar(36) not null, \`created_at\` datetime(3) not null, \`updated_at\` datetime(3) not null, \`version\` int not null default 1, \`user_id\` varchar(36) not null, \`type\` varchar(40) not null, \`email_enabled\` tinyint(1) not null default true, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`notification_preference\` add unique \`notification_preference_user_id_type_unique\` (\`user_id\`, \`type\`);`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists \`notification\`;`);
    this.addSql(`drop table if exists \`notification_preference\`;`);
  }

}
