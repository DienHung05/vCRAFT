import { screen } from '@testing-library/react';
import { Stepper } from '@vcraft/ui';
import { describe, expect, it, vi } from 'vitest';
import { RfqStepper } from '@/features/rfq/rfq-stepper';
import { renderEn, renderVi } from './render';

describe('RfqStepper on phones (GH#478)', () => {
  it('states the current step in a compact line and keeps aria-current on the full strip', () => {
    renderVi(<RfqStepper status="IN_PRODUCTION" hasBids />);
    const nav = screen.getByRole('navigation', { name: 'Tiến trình của yêu cầu báo giá' });
    expect(nav.textContent).toContain('Bước 5/6 · Đang sản xuất');
    const current = nav.querySelectorAll('li[aria-current="step"]');
    expect(current).toHaveLength(1);
    expect(current[0]?.textContent).toContain('Đang sản xuất');
    // The full strip only shows from sm: up; the compact line carries the phone layout.
    expect(nav.querySelector('.sm\\:hidden')).not.toBeNull();
    expect(nav.querySelector('.hidden.sm\\:block')).not.toBeNull();
  });

  it('words the compact line in English', () => {
    renderEn(<RfqStepper status="BIDDING" hasBids />);
    expect(screen.getByText('Step 3 of 6 · Receiving bids')).toBeTruthy();
  });

  it('keeps the compact line on a halted flow', () => {
    renderVi(<RfqStepper status="CANCELLED" hasBids />);
    expect(screen.getByText('Bước 3/3 · Đã hủy')).toBeTruthy();
  });
});

describe('Stepper without a compact label', () => {
  it('always renders the full strip and marks the current step', () => {
    renderVi(
      <Stepper
        label="Tiến trình"
        current={1}
        steps={[
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
          { id: 'c', label: 'C' },
        ]}
      />,
    );
    const nav = screen.getByRole('navigation', { name: 'Tiến trình' });
    expect(nav.querySelector('.sm\\:hidden')).toBeNull();
    expect(nav.querySelector('.hidden')).toBeNull();
    expect(nav.querySelector('li[aria-current="step"]')?.textContent).toContain('B');
  });

  it('scrolls only the strip so the current step is centred', () => {
    const size = vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(1000);
    const client = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(300);
    const rect = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        const box = this.hasAttribute('aria-current')
          ? { left: 700, width: 100 }
          : { left: 0, width: 300 };
        return {
          ...box,
          right: box.left + box.width,
          top: 0,
          bottom: 0,
          height: 0,
          x: box.left,
          y: 0,
          toJSON: () => ({}),
        };
      });
    try {
      renderVi(
        <Stepper
          label="Tiến trình"
          current={2}
          steps={[
            { id: 'a', label: 'A' },
            { id: 'b', label: 'B' },
            { id: 'c', label: 'C' },
          ]}
        />,
      );
      const strip = screen.getByRole('navigation').querySelector<HTMLElement>('[data-steps]');
      // 700 (left of the step) - 0 (left of the strip) - (300 - 100) / 2 = 600.
      expect(strip?.scrollLeft).toBe(600);
    } finally {
      size.mockRestore();
      client.mockRestore();
      rect.mockRestore();
    }
  });
});
