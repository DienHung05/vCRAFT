import { Migration } from '@mikro-orm/migrations';

export class Migration20261108130001_idempotency_keys extends Migration {

  override name = 'Migration20261108130001_idempotency_keys';

  override up(): void | Promise<void> {
    this.addSql(`create table \`idempotency_keys\` (\`id\` varchar(36) not null, \`created_at\` datetime(3) not null, \`updated_at\` datetime(3) not null, \`version\` int not null default 1, \`actor_id\` varchar(36) not null, \`route\` varchar(200) not null, \`idempotency_key\` varchar(255) not null, \`request_hash\` varchar(64) not null, \`response_status\` int null, \`response_body\` json null, primary key (\`id\`)) default character set utf8mb4 engine = InnoDB;`);
    this.addSql(`alter table \`idempotency_keys\` add index \`idempotency_keys_created_at_index\` (\`created_at\`);`);
    this.addSql(`alter table \`idempotency_keys\` add unique \`idempotency_keys_actor_id_route_idempotency_key_unique\` (\`actor_id\`, \`route\`, \`idempotency_key\`);`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists \`idempotency_keys\`;`);
  }

}
