import { Migration } from '@mikro-orm/migrations';

export class Migration20261101041338_consent_record extends Migration {

  override name = 'Migration20261101041338_consent_record';

  override up(): void | Promise<void> {
    this.addSql(`create table \`consent_record\` (\`id\` varchar(36) not null, \`created_at\` datetime(3) not null, \`updated_at\` datetime(3) not null, \`version\` int not null default 1, \`user_id\` varchar(36) not null, \`purpose\` varchar(30) not null, \`policy_version\` varchar(20) not null, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`consent_record\` add index \`consent_record_user_id_purpose_index\` (\`user_id\`, \`purpose\`);`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists \`consent_record\`;`);
  }

}
