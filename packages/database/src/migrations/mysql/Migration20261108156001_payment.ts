import { Migration } from '@mikro-orm/migrations';

export class Migration20261108156001_payment extends Migration {

  override name = 'Migration20261108156001_payment';

  override up(): void | Promise<void> {
    this.addSql(`create table \`payment\` (\`id\` varchar(36) not null, \`created_at\` datetime(3) not null, \`updated_at\` datetime(3) not null, \`version\` int not null default 1, \`order_id\` varchar(36) not null, \`kind\` varchar(20) not null, \`method\` varchar(20) not null, \`provider\` varchar(20) null, \`amount_vnd\` bigint not null, \`reference_code\` varchar(40) not null, \`provider_txn_id\` varchar(100) null, \`status\` varchar(20) not null default 'PENDING', \`expires_at\` datetime(3) null, \`paid_at\` datetime(3) null, \`raw_last_event\` json null, \`checkout\` json null, \`recorded_by\` varchar(36) null, \`note\` varchar(500) null, \`refunded_at\` datetime(3) null, \`refunded_by\` varchar(36) null, \`refund_reason\` varchar(500) null, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`payment\` add index \`payment_order_id_index\` (\`order_id\`);`);
    this.addSql(`alter table \`payment\` add index \`payment_order_id_kind_status_index\` (\`order_id\`, \`kind\`, \`status\`);`);
    this.addSql(`alter table \`payment\` add index \`payment_status_expires_at_index\` (\`status\`, \`expires_at\`);`);
    this.addSql(`alter table \`payment\` add index \`payment_created_at_index\` (\`created_at\`);`);
    this.addSql(`alter table \`payment\` add unique \`payment_reference_code_unique\` (\`reference_code\`);`);
    this.addSql(`alter table \`payment\` add unique \`payment_provider_provider_txn_id_unique\` (\`provider\`, \`provider_txn_id\`);`);

    this.addSql(`alter table \`payment\` add constraint \`payment_order_id_foreign\` foreign key (\`order_id\`) references \`quotation_request\` (\`id\`);`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists \`payment\`;`);
  }

}
