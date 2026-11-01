import { Migration } from '@mikro-orm/migrations';

export class Migration20261101041332_consent_record extends Migration {

  override name = 'Migration20261101041332_consent_record';

  override up(): void | Promise<void> {
    this.addSql(`create table "consent_record" ("id" uuid not null, "created_at" timestamptz(3) not null, "updated_at" timestamptz(3) not null, "version" int not null default 1, "user_id" uuid not null, "purpose" varchar(30) not null, "policy_version" varchar(20) not null, primary key ("id"));`);
    this.addSql(`create index "consent_record_user_id_purpose_index" on "consent_record" ("user_id", "purpose");`);

    this.addSql(`alter table "consent_record" enable row level security;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "consent_record" cascade;`);
  }

}
