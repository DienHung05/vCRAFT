import { screen } from '@testing-library/react';
import { messages } from '@vcraft/i18n';
import { describe, expect, it, vi } from 'vitest';
import MapLoading from '@/app/[locale]/(discover)/ban-do/loading';
import ProductsLoading from '@/app/[locale]/(discover)/san-pham/(list)/loading';
import { renderVi } from './render';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children }: { href: unknown; children: React.ReactNode }) => (
    <a href={typeof href === 'string' ? href : JSON.stringify(href)}>{children}</a>
  ),
}));

/**
 * GH#481: the page headers are the LCP of the list and map pages, so the loading skeleton (the first
 * streamed chunk) must already carry the final heading and lead text instead of grey placeholders.
 */
describe('loading skeletons keep the page header in the first chunk', () => {
  it('map', () => {
    renderVi(<MapLoading />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      messages.vi.villageMap.title,
    );
    expect(screen.getByText(messages.vi.villageMap.lead)).toBeTruthy();
  });

  it('products', () => {
    renderVi(<ProductsLoading />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      messages.vi.indexPages.products.title,
    );
    expect(screen.getByText(messages.vi.indexPages.products.lead)).toBeTruthy();
  });
});
