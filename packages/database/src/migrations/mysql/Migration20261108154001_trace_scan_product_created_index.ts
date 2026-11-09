import { Migration } from '@mikro-orm/migrations';

/** GH#254: the `popular` catalog sort counts a product's scans in the last 30 days (product, created_at). */
export class Migration20261108154001_trace_scan_product_created_index extends Migration {

  override name = 'Migration20261108154001_trace_scan_product_created_index';

  override up(): void | Promise<void> {
    this.addSql(`alter table \`trace_scan\` add index \`trace_scan_product_id_created_at_index\` (\`product_id\`, \`created_at\`);`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table \`trace_scan\` drop index \`trace_scan_product_id_created_at_index\`;`);
  }

}
