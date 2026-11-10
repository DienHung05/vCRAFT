import { Migration } from '@mikro-orm/migrations';

const MIDNIGHT_UTC = /^(\d{4}-\d{2}-\d{2})T00:00:00(?:\.0+)?Z$/;

/** Moves a midnight-UTC instant to the end of the same date in Vietnam (16:59:59 UTC); anything else is untouched. */
function toEndOfVietnamDay(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const match = MIDNIGHT_UTC.exec(value);
  return match ? `${match[1]}T16:59:59.000Z` : value;
}

type Part = { completionDate?: unknown };

function fixParts(raw: unknown): { json: string; changed: boolean } | null {
  const list: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!Array.isArray(list)) return null;
  let changed = false;
  for (const item of list as Part[]) {
    const next = toEndOfVietnamDay(item?.completionDate);
    if (next !== item?.completionDate) {
      item.completionDate = next;
      changed = true;
    }
  }
  return { json: JSON.stringify(list), changed };
}

/**
 * GH#443: households' completion dates were stored as midnight UTC (07:00 in Vietnam) instead of the end of
 * the promised day. Moves every midnight-UTC value (offer column, offer history, quotation parts) to 16:59:59 UTC.
 * Allocation due dates are derived from these values, so no allocation column changes.
 */
export class Migration20261110140000_completion_date_end_of_day extends Migration {

  override name = 'Migration20261110140000_completion_date_end_of_day';

  override async up(): Promise<void> {
    await this.execute(`update "contribution_offer" set "completion_date" = "completion_date" + interval '16 hours 59 minutes 59 seconds' where ("completion_date" at time zone 'UTC')::time = '00:00:00';`);
    await this.fixJson('contribution_offer', 'history');
    await this.fixJson('cooperative_quotation', 'parts');
  }

  private async fixJson(table: string, column: string): Promise<void> {
    const rows = (await this.execute(`select id, "${column}" as value from "${table}"`)) as Array<{ id: string; value: unknown }>;
    for (const row of rows) {
      const fixed = fixParts(row.value);
      if (!fixed?.changed) continue;
      await this.execute(`update "${table}" set "${column}" = ?::jsonb where id = ?`, [fixed.json, row.id]);
    }
  }

  override down(): void | Promise<void> {
    // The original instants are not recoverable: a value already at 16:59:59 UTC may have been entered that way.
  }

}
