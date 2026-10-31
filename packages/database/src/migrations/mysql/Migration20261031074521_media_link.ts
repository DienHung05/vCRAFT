import { Migration } from '@mikro-orm/migrations';

export class Migration20261031074521_media_link extends Migration {

  override name = 'Migration20261031074521_media_link';

  override up(): void | Promise<void> {
    this.addSql(`create table \`media_link\` (\`id\` varchar(36) not null, \`created_at\` datetime(3) not null, \`updated_at\` datetime(3) not null, \`version\` int not null default 1, \`media_id\` varchar(36) not null, \`target_type\` varchar(20) not null, \`target_id\` varchar(36) not null, \`role\` varchar(20) not null, \`position\` int not null default 0, \`alt_text\` varchar(500) null, \`caption\` varchar(300) null, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`media_link\` add index \`media_link_media_id_index\` (\`media_id\`);`);
    this.addSql(`alter table \`media_link\` add index \`media_link_target_type_target_id_index\` (\`target_type\`, \`target_id\`);`);
    this.addSql(`alter table \`media_link\` add unique \`media_link_target_type_target_id_role_position_unique\` (\`target_type\`, \`target_id\`, \`role\`, \`position\`);`);

    this.addSql(`alter table \`media_asset\` add \`alt_text\` varchar(500) null, add \`credit\` json null;`);

    this.addSql(`alter table \`media_link\` add constraint \`media_link_media_id_foreign\` foreign key (\`media_id\`) references \`media_asset\` (\`id\`);`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists \`media_link\`;`);

    this.addSql(`alter table \`media_asset\` drop column \`alt_text\`, drop column \`credit\`;`);
  }

}
