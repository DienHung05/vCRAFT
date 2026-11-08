import { Migration } from '@mikro-orm/migrations';

/** GH#248 s5-11 (FR-ORD-11): the buyer's 1-5 star rating of each household after delivery. */
export class Migration20261108150001_household_ratings extends Migration {

  override name = 'Migration20261108150001_household_ratings';

  override up(): void | Promise<void> {
    this.addSql(`create table \`household_ratings\` (\`id\` varchar(36) not null, \`created_at\` datetime(3) not null, \`updated_at\` datetime(3) not null, \`version\` int not null default 1, \`request_id\` varchar(36) not null, \`household_id\` varchar(36) not null, \`rater_id\` varchar(36) not null, \`stars\` int not null, \`comment\` varchar(1000) null, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`household_ratings\` add index \`household_ratings_request_id_index\` (\`request_id\`);`);
    this.addSql(`alter table \`household_ratings\` add index \`household_ratings_household_id_index\` (\`household_id\`);`);
    this.addSql(`alter table \`household_ratings\` add unique \`household_ratings_request_id_household_id_unique\` (\`request_id\`, \`household_id\`);`);

    this.addSql(`alter table \`household_ratings\` add constraint \`household_ratings_request_id_foreign\` foreign key (\`request_id\`) references \`quotation_request\` (\`id\`);`);
    this.addSql(`alter table \`household_ratings\` add constraint \`household_ratings_household_id_foreign\` foreign key (\`household_id\`) references \`household\` (\`id\`);`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists \`household_ratings\`;`);
  }

}
