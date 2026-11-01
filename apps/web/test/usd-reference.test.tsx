import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UsdRateNote, UsdReference } from '@/components/usd-reference';
import { FALLBACK_USD_RATE, type UsdRate } from '@/lib/currency';
import { useMoney } from '@/lib/use-money';
import { renderEn, renderVi } from './render';

function Money({ vnd }: { vnd: number }) {
  return <p data-testid="money">{useMoney()(vnd)}</p>;
}

const daily: UsdRate = { rate: 26_000, asOf: '2026-10-31' };
// Without a provider the configured fallback rate applies, so derive the expectation from it.
const usd = (vnd: number) => Math.round(vnd / FALLBACK_USD_RATE.rate);

describe('UsdReference', () => {
  it('shows an approximate US$ amount on the English site', () => {
    renderEn(<UsdReference vnd={1_250_000} />);
    expect(screen.getByTestId('usd-reference').textContent).toBe(`≈ US$${usd(1_250_000)}`);
  });

  it('converts at the daily rate from the provider', () => {
    renderEn(<UsdReference vnd={1_300_000} />, daily);
    const element = screen.getByTestId('usd-reference');
    expect(element.textContent).toBe('≈ US$50');
    expect(element.getAttribute('title')).toContain('26,000');
  });

  it('shows nothing on the Vietnamese site', () => {
    renderVi(<UsdReference vnd={1_250_000} />);
    expect(screen.queryByTestId('usd-reference')).toBeNull();
  });

  it('shows nothing for a price on request (zero)', () => {
    renderEn(<UsdReference vnd={0} />);
    expect(screen.queryByTestId('usd-reference')).toBeNull();
  });

  it('keeps cents for small amounts', () => {
    renderEn(<UsdReference vnd={20_000} />);
    expect(screen.getByTestId('usd-reference').textContent).toMatch(/^≈ US\$0\.\d{2}$/);
  });
});

describe('UsdRateNote', () => {
  it('discloses the reference rate in text on the English site only', () => {
    const { unmount } = renderEn(<UsdRateNote />);
    expect(screen.getByText(/reference only/i)).toBeTruthy();
    unmount();
    renderVi(<UsdRateNote />);
    expect(screen.queryByText(/chỉ để tham khảo/)).toBeNull();
  });

  it('shows the daily rate and the date it was published', () => {
    renderEn(<UsdRateNote />, daily);
    const note = screen.getByText(/reference only/i).textContent ?? '';
    expect(note).toContain('US$1 = 26,000');
    expect(note).toContain('Oct 31, 2026');
  });

  it('says the rate is approximate, without a date, when the configured fallback is used', () => {
    renderEn(<UsdRateNote />);
    const note = screen.getByText(/reference only/i).textContent ?? '';
    expect(note).toContain('about US$1 =');
    expect(note).not.toMatch(/rate of/);
  });
});

describe('useMoney', () => {
  it('appends the USD reference for a price inside a sentence on en', () => {
    renderEn(<Money vnd={1_250_000} />);
    expect(screen.getByTestId('money').textContent).toBe(`₫1,250,000 (≈ US$${usd(1_250_000)})`);
  });

  it('uses the daily rate from the provider', () => {
    renderEn(<Money vnd={1_300_000} />, daily);
    expect(screen.getByTestId('money').textContent).toBe('₫1,300,000 (≈ US$50)');
  });

  it('is plain VND on vi and for zero', () => {
    const { unmount } = renderVi(<Money vnd={1_250_000} />);
    expect(screen.getByTestId('money').textContent).toMatch(/^1\.250\.000\s?₫$/);
    unmount();
    renderEn(<Money vnd={0} />);
    expect(screen.getByTestId('money').textContent).toBe('₫0');
  });
});
