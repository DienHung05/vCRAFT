import { Migration } from '@mikro-orm/migrations';

/**
 * GH#236: workshop experience offer (description, duration, price) and the temporarily-closed flag
 * with its reason. A workshop offers an experience exactly when `experience_description` is set.
 */
export class Migration20261108090001_workshop_experience_closure extends Migration {

  override name = 'Migration20261108090001_workshop_experience_closure';

  override up(): void | Promise<void> {
    this.addSql(`alter table \`workshop\` add \`experience_description\` text null, add \`experience_duration_minutes\` int null, add \`experience_price_vnd\` int null, add \`temporarily_closed\` tinyint(1) not null default false, add \`closure_reason\` varchar(300) null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table \`workshop\` drop column \`experience_description\`, drop column \`experience_duration_minutes\`, drop column \`experience_price_vnd\`, drop column \`temporarily_closed\`, drop column \`closure_reason\`;`);
  }

}
