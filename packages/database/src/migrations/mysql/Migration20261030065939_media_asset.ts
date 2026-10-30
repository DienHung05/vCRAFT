import { Migration } from '@mikro-orm/migrations';

export class Migration20261030065939_media_asset extends Migration {

  override name = 'Migration20261030065939_media_asset';

  override up(): void | Promise<void> {
    this.addSql(`create table \`media_asset\` (\`id\` varchar(36) not null, \`created_at\` datetime(3) not null, \`updated_at\` datetime(3) not null, \`version\` int not null default 1, \`owner_id\` varchar(36) not null, \`purpose\` varchar(20) not null, \`visibility\` varchar(10) not null, \`status\` varchar(20) not null default 'PROCESSING', \`mime_type\` varchar(60) not null, \`size_bytes\` int not null, \`sha256\` varchar(64) not null, \`original_key\` varchar(300) not null, \`width\` int null, \`height\` int null, \`thumbhash\` varchar(64) null, \`dominant_color\` varchar(7) null, \`variants\` json not null, \`failure_reason\` varchar(300) null, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`media_asset\` add index \`media_asset_owner_id_sha256_index\` (\`owner_id\`, \`sha256\`);`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists \`media_asset\`;`);
  }

}
