import {
  HouseholdPageResponseSchema,
  NewsPageResponseSchema,
  PublicHouseholdResponseSchema,
  TraceAvailabilityResponseSchema,
} from '../../../packages/contracts/dist/index.mjs';

const base = process.env.PERF_FIXTURE_URL ?? 'http://127.0.0.1:4018/api/v1';
for (const [path, schema] of [
  ['/households?page=1&limit=12', HouseholdPageResponseSchema],
  ['/news?limit=12&page=1', NewsPageResponseSchema],
  ['/households/gom-bich-hop', PublicHouseholdResponseSchema],
  ['/trace/BT7K2QXM', TraceAvailabilityResponseSchema],
]) {
  const response = await fetch(base + path);
  const parsed = schema.safeParse(await response.json());
  console.log(
    JSON.stringify({
      path,
      status: response.status,
      valid: parsed.success,
      issues: parsed.success
        ? []
        : parsed.error.issues.map(({ path, message }) => ({ path, message })),
    }),
  );
}
