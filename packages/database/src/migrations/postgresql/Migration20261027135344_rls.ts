import { Migration } from '@mikro-orm/migrations';

export class Migration20261027135344_rls extends Migration {

  override name = 'Migration20261027135344_rls';

  override up(): void | Promise<void> {
    this.addSql(`alter table "outbox_event" enable row level security;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "outbox_event" disable row level security;`);
  }

}
