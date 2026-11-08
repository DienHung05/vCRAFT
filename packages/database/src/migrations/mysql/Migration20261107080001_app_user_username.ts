import { Migration } from '@mikro-orm/migrations';

/**
 * GH#212: sign-in username, unique and case-insensitive by storing everything lowercase. Existing
 * accounts stay `null`; the four fixed demo accounts are filled right in this migration so their
 * handles exist as soon as the schema is built (the authoritative demo account identities live in
 * `packages/database/src/seeders/demo/accounts.ts`). The `'c'` flag makes the CHECK case-sensitive:
 * MySQL's default collation would otherwise accept uppercase. A CHECK constraint ignores NULL, so
 * accounts that have not chosen a username yet stay valid.
 */
export class Migration20261107080001_app_user_username extends Migration {

  override name = 'Migration20261107080001_app_user_username';

  override up(): void | Promise<void> {
    this.addSql(`alter table \`app_user\` add column \`username\` varchar(30) null;`);
    this.addSql(`alter table \`app_user\` add constraint \`app_user_username_format_check\` check (regexp_like(username, '^[a-z0-9._-]{3,30}$', 'c'));`);
    this.addSql(`alter table \`app_user\` add unique index \`app_user_username_unique\` (\`username\`);`);
    this.addSql(`update \`app_user\` set \`username\` = 'pending' where \`id\` = 'd3a10000-0000-4000-8000-000000000004';`);
    this.addSql(`update \`app_user\` set \`username\` = 'household' where \`id\` = 'd3a10000-0000-4000-8000-000000000003';`);
    this.addSql(`update \`app_user\` set \`username\` = 'buyer' where \`id\` = 'd3a10000-0000-4000-8000-000000000002';`);
    this.addSql(`update \`app_user\` set \`username\` = 'admin' where \`id\` = 'd3a10000-0000-4000-8000-000000000001';`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table \`app_user\` drop index \`app_user_username_unique\`;`);
    this.addSql(`alter table \`app_user\` drop column \`username\`;`);
  }

}
