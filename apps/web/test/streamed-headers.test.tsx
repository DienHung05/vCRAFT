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

/** GH#481: the map's loading skeleton carries its final heading and lead in the first chunk. */
describe('loading skeletons keep the page header in the first chunk', () => {
  it('map', () => {
    renderVi(<MapLoading />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      messages.vi.villageMap.title,
    );
    expect(screen.getByText(messages.vi.villageMap.lead)).toBeTruthy();
  });
});
