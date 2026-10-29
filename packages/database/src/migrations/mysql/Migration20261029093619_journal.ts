import { Migration } from '@mikro-orm/migrations';

export class Migration20261029093619_journal extends Migration {

  override name = 'Migration20261029093619_journal';

  override up(): void | Promise<void> {
    this.addSql(`create table \`journal_entry\` (\`id\` varchar(36) not null, \`created_at\` datetime(3) not null, \`updated_at\` datetime(3) not null, \`version\` int not null default 1, \`product_id\` varchar(36) not null, \`seq\` int not null, \`stage\` varchar(20) not null, \`declared_date\` varchar(10) not null, \`note\` text not null, \`images\` json not null, \`supersedes_id\` varchar(36) null, \`skip_reason\` varchar(300) null, \`prev_hash\` varchar(64) not null, \`hash\` varchar(64) not null, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`journal_entry\` add index \`journal_entry_product_id_index\` (\`product_id\`);`);
    this.addSql(`alter table \`journal_entry\` add index \`journal_entry_supersedes_id_index\` (\`supersedes_id\`);`);
    this.addSql(`alter table \`journal_entry\` add unique \`journal_entry_product_id_seq_unique\` (\`product_id\`, \`seq\`);`);

    this.addSql(`alter table \`journal_entry\` add constraint \`journal_entry_product_id_foreign\` foreign key (\`product_id\`) references \`product\` (\`id\`);`);
    this.addSql(`alter table \`journal_entry\` add constraint \`journal_entry_supersedes_id_foreign\` foreign key (\`supersedes_id\`) references \`journal_entry\` (\`id\`) on delete set null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table \`journal_entry\` drop foreign key \`journal_entry_supersedes_id_foreign\`;`);

    this.addSql(`drop table if exists \`journal_entry\`;`);
  }

}
