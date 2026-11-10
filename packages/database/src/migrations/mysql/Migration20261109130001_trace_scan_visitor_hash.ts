import { Migration } from '@mikro-orm/migrations';

/** GH#362: a visitor hash lets the API count one visitor's repeated scans of a product once per window. */
export class Migration20261109130001_trace_scan_visitor_hash extends Migration {

  override name = 'Migration20261109130001_trace_scan_visitor_hash';

  override up(): void | Promise<void> {
    this.addSql(`alter table \`trace_scan\` add column \`visitor_hash\` varchar(64) null;`);
    this.addSql(`alter table \`trace_scan\` add index \`trace_scan_product_id_visitor_hash_created_at_index\` (\`product_id\`, \`visitor_hash\`, \`created_at\`);`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table \`trace_scan\` drop index \`trace_scan_product_id_visitor_hash_created_at_index\`;`);
    this.addSql(`alter table \`trace_scan\` drop column \`visitor_hash\`;`);
  }

}
