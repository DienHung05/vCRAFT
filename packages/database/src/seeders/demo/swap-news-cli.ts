import 'reflect-metadata';
import { MikroORM, type Options } from '@mikro-orm/core';
import { createMikroOrmOptions } from '../../mikro-orm.config.js';
import { describeDemoTarget } from './guard.js';
import { swapDemoNews } from './swap-news.js';

/**
 * `pnpm news:swap [--dry-run]` (GH#314): replace the invented seed news with the real stories of `pools.ts`
 * on an existing database, keyed on the stable news ids. It never deletes anything and touches no table
 * except `news` and the news cover links. Needs `NEWS_SWAP_CONFIRM=<host>:<port>/<name>` of the target so a
 * copied `.env` cannot hit the wrong database. Run `pnpm demo:media --only=media` first for the cover files.
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
  const target = describeDemoTarget(process.env);
  console.log(`news:swap${dryRun ? ' (dry run)' : ''}: target ${target}`);
  if (process.env.NEWS_SWAP_CONFIRM?.trim() !== target) {
    console.error(
      `Refusing to run: set NEWS_SWAP_CONFIRM=${target} to confirm the target database.`,
    );
    process.exit(2);
  }
  const orm = await MikroORM.init(createMikroOrmOptions(process.env) as unknown as Options);
  try {
    console.log(JSON.stringify(await swapDemoNews(orm.em.fork(), { dryRun })));
    if (!dryRun)
      console.log('Next: pnpm assistant:reindex so the Fox assistant reads the new news.');
  } finally {
    await orm.close(true);
  }
}

main().catch((error: unknown) => {
  console.error('news:swap failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
