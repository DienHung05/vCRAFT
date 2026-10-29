import { Migration } from '@mikro-orm/migrations';

export class Migration20261029092628_household extends Migration {

  override name = 'Migration20261029092628_household';

  override up(): void | Promise<void> {
    this.addSql(`create table \`app_user\` (\`id\` varchar(36) not null, \`email\` varchar(320) not null, \`full_name\` varchar(160) null, \`role\` varchar(20) not null, \`status\` varchar(20) not null default 'ACTIVE', \`created_at\` datetime(3) not null, \`updated_at\` datetime(3) not null, \`version\` int not null default 1, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`app_user\` add unique \`app_user_email_unique\` (\`email\`);`);

    this.addSql(`create table \`audit_log\` (\`id\` varchar(36) not null, \`created_at\` datetime(3) not null, \`updated_at\` datetime(3) not null, \`version\` int not null default 1, \`actor_id\` varchar(36) not null, \`action\` varchar(80) not null, \`entity\` varchar(60) not null, \`entity_id\` varchar(36) not null, \`before\` json null, \`after\` json null, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`audit_log\` add index \`audit_log_entity_entity_id_index\` (\`entity\`, \`entity_id\`);`);

    this.addSql(`create table \`household\` (\`id\` varchar(36) not null, \`created_at\` datetime(3) not null, \`updated_at\` datetime(3) not null, \`version\` int not null default 1, \`name\` varchar(160) not null, \`slug\` varchar(160) not null, \`history\` text not null, \`village\` varchar(160) null, \`status\` varchar(20) not null default 'PENDING_REVIEW', \`status_reason\` varchar(500) null, \`approved_at\` datetime(3) null, \`representative_id\` varchar(36) not null, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`household\` add unique \`household_slug_unique\` (\`slug\`);`);
    this.addSql(`alter table \`household\` add index \`household_representative_id_index\` (\`representative_id\`);`);
    this.addSql(`alter table \`household\` add unique \`household_representative_id_unique\` (\`representative_id\`);`);
    this.addSql(`alter table \`household\` add index \`household_status_index\` (\`status\`);`);

    this.addSql(`create table \`artisan\` (\`id\` varchar(36) not null, \`created_at\` datetime(3) not null, \`updated_at\` datetime(3) not null, \`version\` int not null default 1, \`household_id\` varchar(36) not null, \`name\` varchar(160) not null, \`craft_role\` varchar(160) null, \`bio\` text null, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`artisan\` add index \`artisan_household_id_index\` (\`household_id\`);`);

    this.addSql(`create table \`product\` (\`id\` varchar(36) not null, \`created_at\` datetime(3) not null, \`updated_at\` datetime(3) not null, \`version\` int not null default 1, \`household_id\` varchar(36) not null, \`name\` varchar(200) not null, \`slug\` varchar(200) not null, \`trace_code\` varchar(16) not null, \`description\` text not null, \`kind\` varchar(10) not null default 'OBJECT', \`batch_size\` int null, \`status\` varchar(20) not null default 'DRAFT', \`published_at\` datetime(3) null, \`withdrawn_reason\` varchar(500) null, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`product\` add index \`product_household_id_index\` (\`household_id\`);`);
    this.addSql(`alter table \`product\` add unique \`product_slug_unique\` (\`slug\`);`);
    this.addSql(`alter table \`product\` add unique \`product_trace_code_unique\` (\`trace_code\`);`);
    this.addSql(`alter table \`product\` add index \`product_household_id_status_index\` (\`household_id\`, \`status\`);`);

    this.addSql(`create table \`workshop\` (\`id\` varchar(36) not null, \`created_at\` datetime(3) not null, \`updated_at\` datetime(3) not null, \`version\` int not null default 1, \`household_id\` varchar(36) not null, \`name\` varchar(160) not null, \`address\` varchar(300) not null, \`purpose\` varchar(20) not null default 'PRODUCTION', \`accepts_visitors\` tinyint(1) not null default false, \`visiting_info\` text null, \`lat\` numeric(9,6) null, \`lng\` numeric(9,6) null, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`workshop\` add index \`workshop_household_id_index\` (\`household_id\`);`);
    this.addSql(`alter table \`workshop\` add index \`workshop_lat_lng_index\` (\`lat\`, \`lng\`);`);

    this.addSql(`alter table \`household\` add constraint \`household_representative_id_foreign\` foreign key (\`representative_id\`) references \`app_user\` (\`id\`);`);

    this.addSql(`alter table \`artisan\` add constraint \`artisan_household_id_foreign\` foreign key (\`household_id\`) references \`household\` (\`id\`);`);

    this.addSql(`alter table \`product\` add constraint \`product_household_id_foreign\` foreign key (\`household_id\`) references \`household\` (\`id\`);`);

    this.addSql(`alter table \`workshop\` add constraint \`workshop_household_id_foreign\` foreign key (\`household_id\`) references \`household\` (\`id\`);`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table \`household\` drop foreign key \`household_representative_id_foreign\`;`);
    this.addSql(`alter table \`artisan\` drop foreign key \`artisan_household_id_foreign\`;`);
    this.addSql(`alter table \`product\` drop foreign key \`product_household_id_foreign\`;`);
    this.addSql(`alter table \`workshop\` drop foreign key \`workshop_household_id_foreign\`;`);

    this.addSql(`drop table if exists \`app_user\`;`);
    this.addSql(`drop table if exists \`audit_log\`;`);
    this.addSql(`drop table if exists \`household\`;`);
    this.addSql(`drop table if exists \`artisan\`;`);
    this.addSql(`drop table if exists \`product\`;`);
    this.addSql(`drop table if exists \`workshop\`;`);
  }

}
