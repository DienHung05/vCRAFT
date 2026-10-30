import { Migration } from '@mikro-orm/migrations';

export class Migration20261030044754_order_allocation extends Migration {

  override name = 'Migration20261030044754_order_allocation';

  override up(): void | Promise<void> {
    this.addSql(`create table \`order_allocation\` (\`id\` varchar(36) not null, \`created_at\` datetime(3) not null, \`updated_at\` datetime(3) not null, \`version\` int not null default 1, \`quotation_id\` varchar(36) not null, \`household_id\` varchar(36) not null, \`quantity\` int not null, \`completed_qty\` int not null default 0, \`status\` varchar(20) not null default 'PROPOSED', primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`order_allocation\` add index \`order_allocation_quotation_id_index\` (\`quotation_id\`);`);
    this.addSql(`alter table \`order_allocation\` add index \`order_allocation_household_id_index\` (\`household_id\`);`);
    this.addSql(`alter table \`order_allocation\` add index \`order_allocation_quotation_id_status_index\` (\`quotation_id\`, \`status\`);`);

    this.addSql(`alter table \`order_allocation\` add constraint \`order_allocation_quotation_id_foreign\` foreign key (\`quotation_id\`) references \`cooperative_quotation\` (\`id\`);`);
    this.addSql(`alter table \`order_allocation\` add constraint \`order_allocation_household_id_foreign\` foreign key (\`household_id\`) references \`household\` (\`id\`);`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists \`order_allocation\`;`);
  }

}
