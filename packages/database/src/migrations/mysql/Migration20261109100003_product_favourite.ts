/** FR-CAT-07 (GH#254): products a signed-in user saved to their favourites. */
import { Migration } from '@mikro-orm/migrations';

export class Migration20261109100003_product_favourite extends Migration {

  override name = 'Migration20261109100003_product_favourite';

  override up(): void | Promise<void> {
    this.addSql(`create table \`product_favourite\` (\`id\` varchar(36) not null, \`created_at\` datetime(3) not null, \`updated_at\` datetime(3) not null, \`version\` int not null default 1, \`user_id\` varchar(36) not null, \`product_id\` varchar(36) not null, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`product_favourite\` add index \`product_favourite_product_id_index\` (\`product_id\`);`);
    this.addSql(`alter table \`product_favourite\` add unique \`product_favourite_user_id_product_id_unique\` (\`user_id\`, \`product_id\`);`);
    this.addSql(`alter table \`product_favourite\` add constraint \`product_favourite_product_id_foreign\` foreign key (\`product_id\`) references \`product\` (\`id\`);`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists \`product_favourite\`;`);
  }

}
