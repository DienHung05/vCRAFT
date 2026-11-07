import { Migration } from '@mikro-orm/migrations';

/**
 * GH#239: account administration. `account_invitation` records the role an administrator gave to an
 * invited email (FR-AUTH-03); `app_user.status_reason` keeps why an account was suspended (FR-AUTH-10);
 * `login_event` gains a coarse browser label, the country and the time the session was signed out
 * (FR-AUTH-05).
 */
export class Migration20261108110000_account_administration extends Migration {

  override name = 'Migration20261108110000_account_administration';

  override up(): void | Promise<void> {
    this.addSql(`create table "account_invitation" ("id" uuid not null, "created_at" timestamptz(3) not null, "updated_at" timestamptz(3) not null, "version" int not null default 1, "email" varchar(320) not null, "role" varchar(20) not null, "status" varchar(10) not null default 'PENDING', "invited_by" uuid not null, "accepted_at" timestamptz(3) null, primary key ("id"));`);
    this.addSql(`create index "account_invitation_status_created_at_index" on "account_invitation" ("status", "created_at");`);
    this.addSql(`alter table "account_invitation" add constraint "account_invitation_email_unique" unique ("email");`);

    this.addSql(`alter table "account_invitation" enable row level security;`);

    this.addSql(`alter table "app_user" add column "status_reason" varchar(500) null;`);

    this.addSql(`alter table "login_event" add column "browser" varchar(80) null, add column "country" varchar(2) null, add column "revoked_at" timestamptz(3) null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "login_event" drop column "browser", drop column "country", drop column "revoked_at";`);

    this.addSql(`alter table "app_user" drop column "status_reason";`);

    this.addSql(`drop table if exists "account_invitation" cascade;`);
  }

}
