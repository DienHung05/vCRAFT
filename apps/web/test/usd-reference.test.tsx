import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UsdRateNote, UsdReference } from '@/components/usd-reference';
import { DEFAULT_USD_VND_RATE } from '@/lib/currency';
import { useMoney } from '@/lib/use-money';
import { renderEn, renderVi } from './render';

function Money({ vnd }: { vnd: number }) {
  return <p data-testid="money">{useMoney()(vnd)}</p>;
}

// The default rate is used unless NEXT_PUBLIC_USD_VND_RATE is set, so derive the expectation.
const usd = (vnd: number) =>
  Math.round(vnd / Number(process.env.NEXT_PUBLIC_USD_VND_RATE || DEFAULT_USD_VND_RATE));

describe('UsdReference', () => {
  it('shows an approximate US$ amount on the English site', () => {
    renderEn(<UsdReference vnd={1_250_000} />);
    expect(screen.getByTestId('usd-reference').textContent).toBe(`≈ US$${usd(1_250_000)}`);
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
});

describe('useMoney', () => {
  it('appends the USD reference for a price inside a sentence on en', () => {
    renderEn(<Money vnd={1_250_000} />);
    expect(screen.getByTestId('money').textContent).toBe(`₫1,250,000 (≈ US$${usd(1_250_000)})`);
  });

  it('is plain VND on vi and for zero', () => {
    const { unmount } = renderVi(<Money vnd={1_250_000} />);
    expect(screen.getByTestId('money').textContent).toMatch(/^1\.250\.000\s?₫$/);
    unmount();
    renderEn(<Money vnd={0} />);
    expect(screen.getByTestId('money').textContent).toBe('₫0');
  });
});
