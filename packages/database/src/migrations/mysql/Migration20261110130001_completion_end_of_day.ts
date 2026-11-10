import { Migration } from '@mikro-orm/migrations';

const MIDNIGHT_PART = `("completionDate": "[0-9]{4}-[0-9]{2}-[0-9]{2})T00:00:00([.]000)?Z"`;

/**
 * GH#443: households' completion dates were sent as midnight UTC (07:00 in Vietnam) and turned overdue
 * 17 hours early. A promised day now means its end in Vietnam (23:59:59+07:00), like the buyer's dates;
 * this moves the stored midnight-UTC values (offers, offer history, quotation parts) to that time.
 */
export class Migration20261110130001_completion_end_of_day extends Migration {

  override name = 'Migration20261110130001_completion_end_of_day';

  override up(): void | Promise<void> {
    this.addSql(`update \`contribution_offer\` set \`completion_date\` = date_add(\`completion_date\`, interval 61199 second) where \`completion_date\` = date(\`completion_date\`);`);
    this.addSql(`update \`contribution_offer\` set \`history\` = cast(regexp_replace(cast(\`history\` as char), '${MIDNIGHT_PART}', '$1T16:59:59.000Z"') as json) where cast(\`history\` as char) regexp '${MIDNIGHT_PART}';`);
    this.addSql(`update \`cooperative_quotation\` set \`parts\` = cast(regexp_replace(cast(\`parts\` as char), '${MIDNIGHT_PART}', '$1T16:59:59.000Z"') as json) where cast(\`parts\` as char) regexp '${MIDNIGHT_PART}';`);
  }

  override down(): void | Promise<void> {
    // Data-only fix: the earlier midnight values cannot be told apart from dates chosen after it, so nothing is undone.
  }

}
