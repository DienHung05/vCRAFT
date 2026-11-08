import 'reflect-metadata';
import { MikroORM, type Options } from '@mikro-orm/core';
import { createMikroOrmOptions } from '../../mikro-orm.config.js';
import { describeDemoTarget } from './guard.js';
import { refreshDemoText } from './refresh-text.js';

/**
 * `pnpm demo:refresh-text [--dry-run]`: rewrite the household stories, artisan bios and news text of a demo
 * database seeded before GH#204 and GH#298, and strip the old "sample data" disclaimers. Text columns only:
 * media, users and ids are not touched. Run with `--dry-run` first. Prints the target database and counts,
 * never the text itself.
 */
function parseArgs(argv: readonly string[]): { dryRun: boolean } {
  let dryRun = false;
  for (const arg of argv) {
    if (arg === '--dry-run') dryRun = true;
    else if (arg !== '--') throw new Error(`unknown argument "${arg}"`);
  }
  return { dryRun };
}

async function main(): Promise<void> {
  const { dryRun } = parseArgs(process.argv.slice(2));
  console.log(
    `demo:refresh-text${dryRun ? ' (dry run)' : ''}: target ${describeDemoTarget(process.env)}`,
  );
  const orm = await MikroORM.init(createMikroOrmOptions(process.env) as unknown as Options);
  try {
    const { changedHouseholdSlugs, ...counts } = await refreshDemoText(orm.em.fork(), { dryRun });
    console.log(JSON.stringify(counts));
    if (changedHouseholdSlugs.length > 0) {
      console.log(`households changed: ${changedHouseholdSlugs.join(', ')}`);
    }
    if (!dryRun)
      console.log('Next: pnpm assistant:reindex so the Fox assistant reads the new text.');
  } finally {
    await orm.close(true);
  }
}

main().catch((error: unknown) => {
  console.error('demo:refresh-text failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
