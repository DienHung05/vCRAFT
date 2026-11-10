/** GH#417: unapplied incoming money kept as its own record, and a refund-needed flag on payments. */
import { Migration } from '@mikro-orm/migrations';

export class Migration20261110130001_unapplied_payment extends Migration {

  override name = 'Migration20261110130001_unapplied_payment';

  override up(): void | Promise<void> {
    this.addSql(`create table \`unapplied_payment_event\` (\`id\` varchar(36) not null, \`created_at\` datetime(3) not null, \`updated_at\` datetime(3) not null, \`version\` int not null default 1, \`provider\` varchar(20) not null, \`provider_txn_id\` varchar(100) not null, \`amount_vnd\` bigint not null, \`raw_payload\` json null, \`payment_id\` varchar(36) null, \`order_id\` varchar(36) null, \`reason\` varchar(40) not null, \`status\` varchar(20) not null default 'OPEN', \`resolved_by\` varchar(36) null, \`resolved_at\` datetime(3) null, \`resolved_note\` varchar(500) null, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`unapplied_payment_event\` add index \`unapplied_payment_event_payment_id_index\` (\`payment_id\`);`);
    this.addSql(`alter table \`unapplied_payment_event\` add index \`unapplied_payment_event_order_id_index\` (\`order_id\`);`);
    this.addSql(`alter table \`unapplied_payment_event\` add index \`unapplied_payment_event_status_created_at_index\` (\`status\`, \`created_at\`);`);
    this.addSql(`alter table \`unapplied_payment_event\` add unique \`unapplied_payment_event_provider_provider_txn_id_unique\` (\`provider\`, \`provider_txn_id\`);`);
    this.addSql(`alter table \`unapplied_payment_event\` add constraint \`unapplied_payment_event_payment_id_foreign\` foreign key (\`payment_id\`) references \`payment\` (\`id\`) on update cascade on delete set null;`);
    this.addSql(`alter table \`unapplied_payment_event\` add constraint \`unapplied_payment_event_order_id_foreign\` foreign key (\`order_id\`) references \`quotation_request\` (\`id\`) on update cascade on delete set null;`);
    this.addSql(`alter table \`payment\` add column \`refund_needed_at\` datetime(3) null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table \`payment\` drop column \`refund_needed_at\`;`);
    this.addSql(`drop table if exists \`unapplied_payment_event\`;`);
  }

}
