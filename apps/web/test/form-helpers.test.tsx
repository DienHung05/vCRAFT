import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AmountInWords } from '@/components/amount-in-words';
import { useAddressSuggestions } from '@/lib/address/use-address-suggestions';
import { renderEn, renderVi } from './render';

describe('<AmountInWords>', () => {
  it('reads a VND amount in words on the Vietnamese site', () => {
    const { container } = renderVi(<AmountInWords value="1250000" />);
    expect(container.textContent).toBe('Một triệu hai trăm năm mươi nghìn đồng');
  });

  it('shows nothing for empty or non-numeric input', () => {
    expect(renderVi(<AmountInWords value="" />).container.textContent).toBe('');
    expect(renderVi(<AmountInWords value="12a" />).container.textContent).toBe('');
  });

  it('stays empty on the English site', () => {
    expect(renderEn(<AmountInWords value="1250000" />).container.textContent).toBe('');
  });
});

describe('useAddressSuggestions', () => {
  it('completes the ward and province from the post-2025 list', async () => {
    const { result } = renderHook(() => useAddressSuggestions('Thôn 3, bat trang'));
    await waitFor(() => expect(result.current).toEqual(['Thôn 3, Xã Bát Tràng, Thành phố Hà Nội']));
  });

  it('has 34 provinces in the bundled list', async () => {
    const units = (await import('@/lib/address/vn-administrative-units.json')).default;
    expect(units).toHaveLength(34);
  });
});
