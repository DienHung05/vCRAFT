import { Migration } from '@mikro-orm/migrations';

export class Migration20261029120000_quotation extends Migration {
  override name = 'Migration20261029120000_quotation';

  override up(): void | Promise<void> {
    this.addSql(`create table \`quotation_notice\` (\`id\` varchar(36) not null, \`created_at\` datetime(3) not null, \`updated_at\` datetime(3) not null, \`version\` int not null default 1, \`recipient_id\` varchar(36) not null, \`request_id\` varchar(36) not null, \`quotation_id\` varchar(36) not null, \`kind\` varchar(40) not null default 'QUOTATION_WITHDRAWN', primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`quotation_notice\` add index \`quotation_notice_recipient_id_created_at_index\` (\`recipient_id\`, \`created_at\`);`);
    this.addSql(`create table \`quotation_request\` (\`id\` varchar(36) not null, \`created_at\` datetime(3) not null, \`updated_at\` datetime(3) not null, \`version\` int not null default 1, \`buyer_id\` varchar(36) not null, \`coordinator_id\` varchar(36) null, \`revision\` int not null default 0, \`design\` varchar(500) not null, \`quantity\` int not null, \`unit\` varchar(30) not null, \`destination\` varchar(300) not null, \`required_by\` datetime(3) not null, \`bidding_closes_at\` datetime(3) not null, \`invited_household_ids\` json not null, \`coordination_opt_in\` tinyint(1) not null default false, \`status\` varchar(20) not null default 'DRAFT', primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`quotation_request\` add index \`quotation_request_buyer_id_index\` (\`buyer_id\`);`);
    this.addSql(`alter table \`quotation_request\` add index \`quotation_request_buyer_id_status_index\` (\`buyer_id\`, \`status\`);`);
    this.addSql(`alter table \`quotation_request\` add constraint \`quotation_request_buyer_id_foreign\` foreign key (\`buyer_id\`) references \`app_user\` (\`id\`);`);

    this.addSql(`create table \`contribution_offer\` (\`id\` varchar(36) not null, \`created_at\` datetime(3) not null, \`updated_at\` datetime(3) not null, \`version\` int not null default 1, \`request_id\` varchar(36) not null, \`household_id\` varchar(36) not null, \`max_quantity\` int not null, \`unit_price_vnd\` bigint not null, \`completion_date\` datetime(3) not null, \`status\` varchar(20) not null default 'ACTIVE', \`history\` json not null, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`contribution_offer\` add index \`contribution_offer_request_id_index\` (\`request_id\`);`);
    this.addSql(`alter table \`contribution_offer\` add index \`contribution_offer_household_id_index\` (\`household_id\`);`);
    this.addSql(`alter table \`contribution_offer\` add index \`contribution_offer_request_id_status_index\` (\`request_id\`, \`status\`);`);
    this.addSql(`alter table \`contribution_offer\` add unique \`contribution_offer_request_id_household_id_unique\` (\`request_id\`, \`household_id\`);`);
    this.addSql(`alter table \`contribution_offer\` add constraint \`contribution_offer_request_id_foreign\` foreign key (\`request_id\`) references \`quotation_request\` (\`id\`);`);
    this.addSql(`alter table \`contribution_offer\` add constraint \`contribution_offer_household_id_foreign\` foreign key (\`household_id\`) references \`household\` (\`id\`);`);

    this.addSql(`create table \`cooperative_quotation\` (\`id\` varchar(36) not null, \`created_at\` datetime(3) not null, \`updated_at\` datetime(3) not null, \`version\` int not null default 1, \`request_id\` varchar(36) not null, \`status\` varchar(20) not null default 'SUBMITTED', \`quantity\` int not null, \`parts\` json not null, \`production_total_vnd\` bigint not null, \`additional_charge_vnd\` bigint not null default '0', \`total_vnd\` bigint not null, \`delivery_terms\` varchar(20) not null, \`bid_type\` varchar(20) not null default 'COOPERATIVE', primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`cooperative_quotation\` add index \`cooperative_quotation_request_id_index\` (\`request_id\`);`);
    this.addSql(`alter table \`cooperative_quotation\` add index \`cooperative_quotation_request_id_status_index\` (\`request_id\`, \`status\`);`);
    this.addSql(`alter table \`cooperative_quotation\` add constraint \`cooperative_quotation_request_id_foreign\` foreign key (\`request_id\`) references \`quotation_request\` (\`id\`);`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists \`quotation_notice\`;`);
    this.addSql(`drop table if exists \`cooperative_quotation\`;`);
    this.addSql(`drop table if exists \`contribution_offer\`;`);
    this.addSql(`drop table if exists \`quotation_request\`;`);
  }
}
