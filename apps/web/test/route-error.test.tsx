import { fireEvent, render, screen } from '@testing-library/react';
import { messages } from '@vcraft/i18n';
import { describe, expect, it, vi } from 'vitest';
import LocaleError from '@/app/[locale]/error';
import GlobalError from '@/app/global-error';
import { DataUnavailable } from '@/components/data-unavailable';
import { RouteError } from '@/components/states/route-error';
import { renderEn, renderVi } from './render';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe('RouteError', () => {
  it('shows the generic copy, not the session copy, in Vietnamese', () => {
    renderVi(<RouteError reset={() => {}} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      messages.vi.errors.generic.title,
    );
    expect(screen.queryByText(messages.vi.auth.serviceDown.title)).toBeNull();
    expect(
      screen.getByRole('link', { name: messages.vi.errors.generic.home }).getAttribute('href'),
    ).toBe('/');
  });

  it('shows the English copy', () => {
    renderEn(<RouteError reset={() => {}} />);
    expect(screen.getByText(messages.en.errors.generic.body)).toBeTruthy();
  });

  it('retry calls reset', () => {
    const reset = vi.fn();
    renderVi(<LocaleError error={new Error('boom')} reset={reset} />);
    fireEvent.click(screen.getByRole('button', { name: messages.vi.errors.generic.retry }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});

describe('GlobalError', () => {
  it('renders bilingual static copy and a retry button without any provider', () => {
    const reset = vi.fn();
    // The component renders <html>; mount it into the test document's own root to avoid nesting warnings.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<GlobalError error={new Error('boom')} reset={reset} />, {
      container: document.documentElement,
    });
    spy.mockRestore();
    expect(screen.getByText('Something went wrong on our side')).toBeTruthy();
    expect(screen.getByText('Đã có trục trặc ở phía chúng tôi')).toBeTruthy();
    fireEvent.click(screen.getByRole('button'));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});

describe('DataUnavailable heading', () => {
  it('renders an h1 when given a heading', () => {
    renderVi(<DataUnavailable heading="Tiêu đề" />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Tiêu đề');
  });
});
