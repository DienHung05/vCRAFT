import { screen } from '@testing-library/react';
import { messages } from '@vcraft/i18n';
import { describe, expect, it, vi } from 'vitest';
import MapLoading from '@/app/[locale]/(discover)/ban-do/loading';
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
  // The products list has no skeleton any more (GH#529): its first row ships in the first flush.
  it('map', () => {
    renderVi(<MapLoading />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      messages.vi.villageMap.title,
    );
    expect(screen.getByText(messages.vi.villageMap.lead)).toBeTruthy();
  });
});
