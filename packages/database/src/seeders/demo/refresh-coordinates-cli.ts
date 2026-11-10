import 'reflect-metadata';
import { MikroORM, type Options } from '@mikro-orm/core';
import { createMikroOrmOptions } from '../../mikro-orm.config.js';
import { describeDemoTarget, evaluateDemoResetGuard } from './guard.js';
import { refreshDemoCoordinates } from './refresh-coordinates.js';

/**
 * `pnpm demo:refresh-coordinates [--dry-run]` (GH#396): move the seeded demo workshop pins that lie outside
 * the Bát Tràng commune polygon to the nearest point inside it. Writes only `workshop.lat` and `workshop.lng`
 * of the workshops with deterministic demo ids. A dry run is read-only and needs no guard; a real run needs the
 * same environment guard as `demo:reset` (APP_ENV=demo and DEMO_RESET_CONFIRM naming the target database).
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
    `demo:refresh-coordinates${dryRun ? ' (dry run)' : ''}: target ${describeDemoTarget(process.env)}`,
  );
  if (!dryRun) {
    const guard = evaluateDemoResetGuard(process.env);
    if (!guard.allowed) {
      console.error('demo:refresh-coordinates refused:');
      for (const reason of guard.reasons) console.error(`- ${reason}`);
      console.error('Nothing was changed.');
      process.exit(1);
    }
  }
  const orm = await MikroORM.init(createMikroOrmOptions(process.env) as unknown as Options);
  try {
    const { changedWorkshopIds, ...counts } = await refreshDemoCoordinates(orm.em.fork(), {
      dryRun,
    });
    console.log(JSON.stringify(counts));
    if (changedWorkshopIds.length > 0) {
      console.log(`workshops moved: ${changedWorkshopIds.join(', ')}`);
    }
  } finally {
    await orm.close(true);
  }
}

main().catch((error: unknown) => {
  console.error('demo:refresh-coordinates failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
