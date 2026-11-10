import { Migration } from '@mikro-orm/migrations';

const MIDNIGHT_PART = `("completionDate": "[0-9]{4}-[0-9]{2}-[0-9]{2})T00:00:00([.]000)?Z"`;

/**
 * GH#443: households' completion dates were sent as midnight UTC (07:00 in Vietnam) and turned overdue
 * 17 hours early. A promised day now means its end in Vietnam (23:59:59+07:00), like the buyer's dates;
 * this moves the stored midnight-UTC values (offers, offer history, quotation parts) to that time.
 */
export class Migration20261110130000_completion_end_of_day extends Migration {

  override name = 'Migration20261110130000_completion_end_of_day';

  override up(): void | Promise<void> {
    this.addSql(`update "contribution_offer" set "completion_date" = "completion_date" + interval '16 hours 59 minutes 59 seconds' where ("completion_date" at time zone 'UTC')::time = time '00:00:00';`);
    this.addSql(`update "contribution_offer" set "history" = regexp_replace("history"::text, '${MIDNIGHT_PART}', '\\1T16:59:59.000Z"', 'g')::jsonb where "history"::text ~ '${MIDNIGHT_PART}';`);
    this.addSql(`update "cooperative_quotation" set "parts" = regexp_replace("parts"::text, '${MIDNIGHT_PART}', '\\1T16:59:59.000Z"', 'g')::jsonb where "parts"::text ~ '${MIDNIGHT_PART}';`);
  }

  override down(): void | Promise<void> {
    // Data-only fix: the earlier midnight values cannot be told apart from dates chosen after it, so nothing is undone.
  }

}
