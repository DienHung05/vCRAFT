import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATALOG_PAGE_SIZE } from '@/features/catalog/catalog-page-size';
import { productsQueryString } from '@/features/catalog/exhibition-query';

// vitest runs from apps/web
const read = (relative: string) => readFileSync(join(process.cwd(), 'src', relative), 'utf8');

describe('catalog page size (issue #201)', () => {
  it('is a plain number the server can put in the products query', () => {
    expect(CATALOG_PAGE_SIZE).toBe(12);
    expect(productsQueryString({ page: 1, limit: CATALOG_PAGE_SIZE })).toBe('page=1&limit=12');
  });

  it('lives in a module that is not a client module', () => {
    // A constant exported from a `'use client'` file reaches server code as a client reference
    // function, so `limit=function(){throw ...}` was sent and the API answered 422.
    expect(read('features/catalog/catalog-page-size.ts')).not.toMatch(/^['"]use client['"]/m);
  });

  it('is imported by the server page from that module', () => {
    const page = read('app/[locale]/(discover)/san-pham/(list)/page.tsx');
    expect(page).toContain("from '@/features/catalog/catalog-page-size'");
  });
});
