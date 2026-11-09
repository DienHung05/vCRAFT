/**
 * GH#255 (NFR-PERF-03): indexes behind the public read endpoints. PostgreSQL does not index foreign keys on
 * its own: `artisan.household_id` and `workshop.household_id` serve the household list and detail and the map
 * pins, `trace_scan.product_id` serves the scan count on `GET /trace/:code`, and `media_asset.sha256` serves the
 * journal photo lookup (`entryImages`), which the existing `(owner_id, sha256)` index cannot (owner leads).
 */
import { Migration } from '@mikro-orm/migrations';

export class Migration20261108140000_public_read_indexes extends Migration {

  override name = 'Migration20261108140000_public_read_indexes';

  override up(): void | Promise<void> {
    this.addSql(`create index "artisan_household_id_index" on "artisan" ("household_id");`);
    this.addSql(`create index "workshop_household_id_index" on "workshop" ("household_id");`);
    this.addSql(`create index "trace_scan_product_id_index" on "trace_scan" ("product_id");`);
    this.addSql(`create index "media_asset_sha256_index" on "media_asset" ("sha256");`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop index "artisan_household_id_index";`);
    this.addSql(`drop index "workshop_household_id_index";`);
    this.addSql(`drop index "trace_scan_product_id_index";`);
    this.addSql(`drop index "media_asset_sha256_index";`);
  }

}
