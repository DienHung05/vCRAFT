import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PERF_ROUTES } from './public-routes.mjs';

const output = path.resolve(
  process.env.LIGHTHOUSE_OUTPUT ?? '../../docs/design/audits/301/lighthouse.json',
);
const temporary = await mkdtemp(path.join(tmpdir(), 'vcraft-ui-lighthouse-'));
const origins = {
  before: process.env.LIGHTHOUSE_BEFORE_URL ?? 'http://localhost:3011',
  after: process.env.LIGHTHOUSE_AFTER_URL ?? 'http://localhost:3001',
};
const pages = PERF_ROUTES.filter(
  (page) =>
    !process.env.LIGHTHOUSE_PAGES || process.env.LIGHTHOUSE_PAGES.split(',').includes(page.id),
);
const environment =
  process.env.LIGHTHOUSE_ENVIRONMENT ?? 'production, mobile Lighthouse default throttling';
// Extend an existing paired comparison without discarding earlier measurements.
const previous =
  process.env.LIGHTHOUSE_APPEND === '1' ? JSON.parse(await readFile(output, 'utf8')).records : [];
const records = [...previous];
const totalRuns = Number(process.env.LIGHTHOUSE_RUNS ?? 5);
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

for (const page of pages) {
  for (let run = 1; run <= totalRuns; run++) {
    // Alternate order to avoid consistently giving one build the warmer network path.
    const pair = Object.entries(origins);
    if (run % 2 === 0) pair.reverse();
    for (const [version, origin] of pair) {
      if (
        records.some(
          (record) => record.page === page.id && record.version === version && record.run === run,
        )
      )
        continue;
      const reportPath = path.join(temporary, `${page.id}-${version}-${run}.json`);
      const result = spawnSync(
        'pnpm',
        [
          'dlx',
          'lighthouse',
          `${origin}${page.path}`,
          '--only-categories=performance',
          '--output=json',
          `--output-path=${reportPath}`,
          '--chrome-flags=--headless=new --no-sandbox',
          '--quiet',
        ],
        { timeout: 120000, encoding: 'utf8', env: process.env },
      );
      if (result.status !== 0)
        throw new Error(`Lighthouse ${page.id} ${version}: ${result.stderr || result.error}`);
      const report = JSON.parse(await readFile(reportPath, 'utf8'));
      if (report.runtimeError)
        throw new Error(`${page.id}: ${JSON.stringify(report.runtimeError)}`);
      const value = (audit) => report.audits[audit]?.numericValue ?? null;
      const record = {
        page: page.id,
        path: page.path,
        version,
        run,
        performance: Math.round(report.categories.performance.score * 100),
        cls: value('cumulative-layout-shift'),
        lcpMs: value('largest-contentful-paint'),
        fcpMs: value('first-contentful-paint'),
        tbtMs: value('total-blocking-time'),
        lighthouseVersion: report.lighthouseVersion,
        userAgent: report.userAgent,
        settings: report.configSettings,
      };
      records.push(record);
      await writeFile(output, `${JSON.stringify({ environment, records }, null, 2)}\n`);
      console.log(
        JSON.stringify({
          page: page.id,
          version,
          run,
          performance: record.performance,
          cls: record.cls,
        }),
      );
    }
  }
}
const comparisons = pages.map((page) => ({
  page: page.id,
  ...Object.fromEntries(
    Object.keys(origins).map((version) => {
      const group = records.filter(
        (record) => record.page === page.id && record.version === version,
      );
      return [
        version,
        Object.fromEntries(
          ['performance', 'cls', 'lcpMs', 'fcpMs', 'tbtMs'].map((metric) => [
            metric,
            median(group.map((record) => record[metric])),
          ]),
        ),
      ];
    }),
  ),
}));
await writeFile(output, `${JSON.stringify({ environment, records, comparisons }, null, 2)}\n`);
console.log(JSON.stringify({ comparisons, reports: temporary }));

if (process.env.LIGHTHOUSE_ASSERT_NO_REGRESSION === '1') {
  const failed = comparisons.filter(
    (page) => page.after.performance < page.before.performance || page.after.cls > page.before.cls,
  );
  if (failed.length || !comparisons.length) {
    console.error(JSON.stringify({ noRegression: false, pages: failed.map((page) => page.page) }));
    process.exitCode = 1;
  }
}
