import { describe, expect, it, vi } from 'vitest';
import {
  redactSql,
  SlowQueryLogger,
  slowQueryOptions,
  slowQueryThresholdMs,
} from './slow-query-logger';

describe('slow query log (GH#537)', () => {
  it('drops string and number literals but keeps the statement shape', () => {
    expect(
      redactSql(
        "select * from `notification` where `recipient_id` = 'a@b.vn' and `n` > 42 limit 20",
      ),
    ).toBe('select * from `notification` where `recipient_id` = ? and `n` > ? limit ?');
  });

  it('logs the duration and the redacted SQL', () => {
    const write = vi.fn();
    new SlowQueryLogger(write).logQuery({ query: "select 1 from t where x = 'secret'", took: 310 });
    expect(write).toHaveBeenCalledWith('310ms select ? from t where x = ?');
  });

  it('reads the threshold from SLOW_QUERY_MS with a default of 200', () => {
    expect(slowQueryThresholdMs({})).toBe(200);
    expect(slowQueryThresholdMs({ SLOW_QUERY_MS: '75' })).toBe(75);
    expect(slowQueryOptions({ SLOW_QUERY_MS: '75' }).slowQueryThreshold).toBe(75);
  });
});
