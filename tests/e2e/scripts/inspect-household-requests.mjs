import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const web = process.env.PERF_WEB_URL ?? 'http://localhost:3008';
const fixture = process.env.PERF_FIXTURE_URL ?? 'http://127.0.0.1:4018';
const output = path.resolve(
  process.env.PERF_REQUEST_OUTPUT ?? '../../docs/design/audits/301/household-requests-after.json',
);
const observations = [];
let previousCalls = 0;
const control = async (action) => {
  const response = await fetch(`${fixture}/__${action}`, { method: 'POST' });
  if (!response.ok) throw new Error(`Fixture ${action}: HTTP ${response.status}`);
};
await control('reset');
try {
  for (const phase of ['first', 'next', 'suspended']) {
    if (phase === 'suspended') await control('suspend');
    const start = performance.now();
    const response = await fetch(`${web}/vi/nghe-nhan/gom-bich-hop`);
    const ttfbMs = performance.now() - start;
    const html = await response.text();
    const metrics = await (await fetch(`${fixture}/__metrics`)).json();
    observations.push({
      phase,
      status: response.status,
      householdVisible: html.includes('Gốm Bích Hợp'),
      calls: metrics.calls,
      apiReads: metrics.calls - previousCalls,
      ttfbMs: Math.round(ttfbMs),
      latencyMs: metrics.latencyMs,
    });
    previousCalls = metrics.calls;
  }
} finally {
  await control('reset');
}
// Next starts a new error render after notFound(), with its own React memoization scope.
// Assert one read for each successful render; independently verify the next request's 404.
const noDuplicateReads = observations
  .filter((entry) => entry.phase !== 'suspended')
  .every((entry) => entry.apiReads === 1);
const freshModeration =
  observations[0].householdVisible &&
  observations[1].householdVisible &&
  !observations[2].householdVisible;
const result = { web, observations, noDuplicateReads, freshModeration };
await writeFile(output, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result));
if (!noDuplicateReads || !freshModeration) process.exitCode = 1;
