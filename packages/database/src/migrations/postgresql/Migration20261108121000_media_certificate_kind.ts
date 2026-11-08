/**
 * vCRAFT-8my.3: what a private CERTIFICATE document evidences. Existing rows (uploads made before
 * classification) read as `UNKNOWN`.
 */
import { Migration } from '@mikro-orm/migrations';

export class Migration20261108121000_media_certificate_kind extends Migration {

  override name = 'Migration20261108121000_media_certificate_kind';

  override up(): void | Promise<void> {
    this.addSql(`alter table "media_asset" add column "certificate_kind" varchar(10) not null default 'UNKNOWN';`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "media_asset" drop column "certificate_kind";`);
  }

}
