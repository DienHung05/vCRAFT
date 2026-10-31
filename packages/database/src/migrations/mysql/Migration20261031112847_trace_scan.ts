import { Migration } from '@mikro-orm/migrations';

export class Migration20261031112847_trace_scan extends Migration {

  override name = 'Migration20261031112847_trace_scan';

  override up(): void | Promise<void> {
    this.addSql(`create table \`trace_scan\` (\`id\` varchar(36) not null, \`created_at\` datetime(3) not null, \`updated_at\` datetime(3) not null, \`version\` int not null default 1, \`product_id\` varchar(36) not null, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`trace_scan\` add index \`trace_scan_product_id_index\` (\`product_id\`);`);
    this.addSql(`alter table \`trace_scan\` add index \`trace_scan_created_at_index\` (\`created_at\`);`);

    this.addSql(`alter table \`trace_scan\` add constraint \`trace_scan_product_id_foreign\` foreign key (\`product_id\`) references \`product\` (\`id\`) on delete cascade;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists \`trace_scan\`;`);
  }

}
