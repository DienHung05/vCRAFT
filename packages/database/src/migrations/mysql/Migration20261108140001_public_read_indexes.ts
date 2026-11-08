/**
 * GH#255 (NFR-PERF-03): index behind the public read endpoints. MySQL already indexes the foreign keys
 * (`artisan.household_id`, `workshop.household_id`, `trace_scan.product_id`), so only `media_asset.sha256`
 * is new: the journal photo lookup (`entryImages`) filters by checksum alone, which the existing
 * `(owner_id, sha256)` index cannot serve (owner leads).
 */
import { Migration } from '@mikro-orm/migrations';

export class Migration20261108140001_public_read_indexes extends Migration {

  override name = 'Migration20261108140001_public_read_indexes';

  override up(): void | Promise<void> {
    this.addSql(`alter table \`media_asset\` add index \`media_asset_sha256_index\` (\`sha256\`);`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table \`media_asset\` drop index \`media_asset_sha256_index\`;`);
  }

}
