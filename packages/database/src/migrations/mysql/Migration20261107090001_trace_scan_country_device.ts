import { Migration } from '@mikro-orm/migrations';

/** GH#235: country (ISO 3166-1 alpha-2) and device class of a QR scan; both optional, no IP address is stored. */
export class Migration20261107090001_trace_scan_country_device extends Migration {

  override name = 'Migration20261107090001_trace_scan_country_device';

  override up(): void | Promise<void> {
    this.addSql(`alter table \`trace_scan\` add column \`country\` varchar(2) null, add column \`device_type\` varchar(10) null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table \`trace_scan\` drop column \`country\`, drop column \`device_type\`;`);
  }

}
