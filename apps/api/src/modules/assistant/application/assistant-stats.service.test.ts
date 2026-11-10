import { describe, expect, it } from 'vitest';
import { percentile } from './assistant-stats.service';

describe('percentile', () => {
  it('uses the nearest rank', () => {
    const values = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
    expect(percentile(values, 50)).toBe(500);
    expect(percentile(values, 95)).toBe(1000);
    expect(percentile([42], 95)).toBe(42);
    expect(percentile([], 50)).toBeNull();
  });
});

// The stats categories are aggregated in SQL; apps/api/test/integration/assistant-stats.integration.test.ts covers them.
