import 'reflect-metadata';
import { MikroORM, type Options } from '@mikro-orm/core';
import { createFieldCipher } from '../../crypto/field-cipher.js';
import { createMikroOrmOptions } from '../../mikro-orm.config.js';
import { backfillDemoIdNumbers, type IdNumberBackfillOptions } from './backfill-id-numbers.js';

/**
 * `pnpm demo:backfill-id-numbers [--dry-run] [--limit N] [--slug <household slug>]`: encrypt the fake citizen
 * ID number into demo households seeded before field encryption (empty `id_number_enc`). Only demo households
 * are touched. Prints counts and slugs, never numbers or keys.
 */
function parseArgs(argv: readonly string[]): IdNumberBackfillOptions {
  let dryRun = false;
  let limit: number | undefined;
  let slug: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') dryRun = true;
    else if (arg === '--limit') {
      limit = Number(argv[++i]);
      if (!Number.isInteger(limit) || limit < 1)
        throw new Error('--limit needs a positive integer');
    } else if (arg === '--slug') {
      slug = argv[++i];
      if (!slug) throw new Error('--slug needs a household slug');
    } else if (arg !== '--') throw new Error(`unknown argument "${arg}"`);
  }
  return {
    dryRun,
    ...(limit === undefined ? {} : { limit }),
    ...(slug === undefined ? {} : { slug }),
  };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const cipher = createFieldCipher(process.env);
  const orm = await MikroORM.init(createMikroOrmOptions(process.env) as unknown as Options);
  try {
    const { slugs, ...counts } = await backfillDemoIdNumbers(orm.em.fork(), cipher, options);
    console.log(
      `demo:backfill-id-numbers${counts.dryRun ? ' (dry run)' : ''}: key ${cipher.currentKeyId}`,
      JSON.stringify(counts),
    );
    if (slugs.length > 0) console.log(`households: ${slugs.join(', ')}`);
  } finally {
    await orm.close(true);
  }
}

main().catch((error: unknown) => {
  // The error is a FieldEncryptionError, a usage error or a database error; none carries key or value material.
  console.error('demo:backfill-id-numbers failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
