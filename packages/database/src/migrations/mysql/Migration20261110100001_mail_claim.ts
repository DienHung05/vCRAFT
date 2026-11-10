/** GH#429: durable mail claims, and a sent marker on the notice claim so a crashed claim can expire. */
import { Migration } from '@mikro-orm/migrations';

export class Migration20261110100001_mail_claim extends Migration {

  override name = 'Migration20261110100001_mail_claim';

  override up(): void | Promise<void> {
    this.addSql(`create table \`mail_claim\` (\`id\` varchar(36) not null, \`created_at\` datetime(3) not null, \`updated_at\` datetime(3) not null, \`version\` int not null default 1, \`claim_key\` varchar(100) not null, \`claimed_at\` datetime(3) not null, \`sent_at\` datetime(3) null, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`mail_claim\` add unique \`mail_claim_claim_key_unique\` (\`claim_key\`);`);
    this.addSql(`alter table \`quotation_notice\` add column \`email_sent_at\` datetime(3) null;`);
    this.addSql(`alter table \`notification\` add column \`email_sent_at\` datetime(3) null;`);
    // Notices claimed before this change were treated as sent; keep them from being re-sent.
    this.addSql(`update \`quotation_notice\` set \`email_sent_at\` = \`emailed_at\` where \`emailed_at\` is not null;`);
    this.addSql(`update \`notification\` set \`email_sent_at\` = \`emailed_at\` where \`emailed_at\` is not null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table \`notification\` drop column \`email_sent_at\`;`);
    this.addSql(`alter table \`quotation_notice\` drop column \`email_sent_at\`;`);
    this.addSql(`drop table if exists \`mail_claim\`;`);
  }

}
