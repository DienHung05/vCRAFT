import { describe, expect, it } from 'vitest';
import { cn } from '../src/lib/cn';

describe('cn', () => {
  it('giữ cả cỡ chữ và màu chữ tùy biến', () => {
    expect(cn('text-h1', 'text-ink')).toBe('text-h1 text-ink');
  });

  it('biết nhịp biên tập và khung tùy biến khi gộp', () => {
    expect(cn('px-gutter', 'px-4')).toBe('px-4');
    expect(cn('py-section', 'py-2')).toBe('py-2');
    expect(cn('max-w-editorial', 'max-w-xl')).toBe('max-w-xl');
    expect(cn('max-w-prose-vn', 'max-w-xl')).toBe('max-w-xl');
  });
});
