import { Migration } from '@mikro-orm/migrations';

export class Migration20261029094654_product_maker extends Migration {

  override name = 'Migration20261029094654_product_maker';

  override up(): void | Promise<void> {
    this.addSql(`create table \`product_maker\` (\`id\` varchar(36) not null, \`created_at\` datetime(3) not null, \`updated_at\` datetime(3) not null, \`version\` int not null default 1, \`product_id\` varchar(36) not null, \`artisan_id\` varchar(36) not null, \`contribution\` varchar(160) not null, \`position\` int not null, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`product_maker\` add index \`product_maker_product_id_index\` (\`product_id\`);`);
    this.addSql(`alter table \`product_maker\` add index \`product_maker_artisan_id_index\` (\`artisan_id\`);`);
    this.addSql(`alter table \`product_maker\` add unique \`product_maker_product_id_artisan_id_unique\` (\`product_id\`, \`artisan_id\`);`);

    this.addSql(`alter table \`product_maker\` add constraint \`product_maker_product_id_foreign\` foreign key (\`product_id\`) references \`product\` (\`id\`);`);
    this.addSql(`alter table \`product_maker\` add constraint \`product_maker_artisan_id_foreign\` foreign key (\`artisan_id\`) references \`artisan\` (\`id\`);`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists \`product_maker\`;`);
  }

}
