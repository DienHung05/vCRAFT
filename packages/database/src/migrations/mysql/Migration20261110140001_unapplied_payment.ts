import { Migration } from '@mikro-orm/migrations';

/**
 * GH#417: money that could not be applied keeps its own record (`unapplied_payment`, one row per provider
 * transaction) instead of overwriting the payment's last event, and a paid payment of a cancelled order is
 * flagged as owed back (`payment.refund_due_at`).
 */
export class Migration20261110140001_unapplied_payment extends Migration {

  override name = 'Migration20261110140001_unapplied_payment';

  override up(): void | Promise<void> {
    this.addSql(`create table \`unapplied_payment\` (\`id\` varchar(36) not null, \`created_at\` datetime(3) not null, \`updated_at\` datetime(3) not null, \`version\` int not null default 1, \`payment_id\` varchar(36) null, \`provider\` varchar(20) not null, \`provider_txn_id\` varchar(100) not null, \`reference_code\` varchar(40) not null, \`amount_vnd\` bigint not null, \`expected_amount_vnd\` bigint null, \`reason\` varchar(30) not null, \`raw\` json null, \`status\` varchar(20) not null default 'OPEN', \`resolved_at\` datetime(3) null, \`resolved_by\` varchar(36) null, \`resolution\` varchar(500) null, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`unapplied_payment\` add index \`unapplied_payment_payment_id_index\` (\`payment_id\`);`);
    this.addSql(`alter table \`unapplied_payment\` add index \`unapplied_payment_status_created_at_index\` (\`status\`, \`created_at\`);`);
    this.addSql(`alter table \`unapplied_payment\` add unique \`unapplied_payment_provider_provider_txn_id_unique\` (\`provider\`, \`provider_txn_id\`);`);
    this.addSql(`alter table \`payment\` add \`refund_due_at\` datetime(3) null;`);
    this.addSql(`alter table \`unapplied_payment\` add constraint \`unapplied_payment_payment_id_foreign\` foreign key (\`payment_id\`) references \`payment\` (\`id\`) on delete set null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table \`payment\` drop column \`refund_due_at\`;`);
    this.addSql(`drop table if exists \`unapplied_payment\`;`);
  }

}
