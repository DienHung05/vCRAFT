import { act, render } from '@testing-library/react';
import { SealStamp, Skeleton, stampShakeClass } from '@vcraft/ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TabBrush } from '@/experience/motion/tab-brush';

const reduced = vi.hoisted(() => ({ value: false }));
vi.mock('motion/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('motion/react')>()),
  useReducedMotion: () => reduced.value,
}));

afterEach(() => {
  reduced.value = false;
});

describe('seal stamp (BRAND §6.3 #2, GH#175)', () => {
  it('presses down, spreads the ink and washes it out under the seal', () => {
    const { container } = render(<SealStamp title="Đã đóng ấn" />);
    expect(container.querySelector('.animate-stamp')).toBeTruthy();
    expect(container.querySelector('.seal-stamp-wash')).toBeTruthy();
    const spread = container.querySelector('feDisplacementMap animate');
    expect(spread?.getAttribute('attributeName')).toBe('scale');
    expect(spread?.getAttribute('dur')).toBe('520ms');
  });

  it('stays within 280 ms in Studio and Admin', () => {
    const { container } = render(<SealStamp tempo="tool" />);
    expect(container.querySelector('[data-tempo="tool"]')).toBeTruthy();
    expect(container.querySelector('feDisplacementMap animate')?.getAttribute('dur')).toBe('280ms');
    expect(stampShakeClass('tool')).toBe('animate-stamp-shake-quick');
    expect(stampShakeClass()).toBe('animate-stamp-shake');
  });

  it('is only a fade under reduced motion: no ink spread, no wash', () => {
    reduced.value = true;
    const { container } = render(<SealStamp title="Đã đóng ấn" />);
    expect(container.querySelector('.animate-stamp')).toBeTruthy();
    expect(container.querySelector('.seal-stamp-wash')).toBeNull();
    expect(container.querySelector('feDisplacementMap animate')).toBeNull();
    expect(container.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('Đã đóng ấn');
  });
});

describe('unfired-clay skeleton', () => {
  it('uses the clay sheen instead of the grey pulse', () => {
    const { container } = render(<Skeleton className="h-4 w-20" />);
    const block = container.firstElementChild as HTMLElement;
    expect(block.className).toContain('clay-skeleton');
    expect(block.className).not.toContain('animate-pulse');
    expect(block.getAttribute('aria-hidden')).toBe('true');
  });
});

function Tabs({ active }: { active: number }) {
  return (
    <nav style={{ position: 'relative' }}>
      <ul>
        {[0, 1, 2].map((i) => (
          <li key={i}>
            <a href={`#${i}`} data-i={i} aria-current={i === active ? 'page' : undefined}>
              Tab {i}
            </a>
          </li>
        ))}
      </ul>
      <TabBrush activeKey={String(active)} />
    </nav>
  );
}

describe('tab brush underline', () => {
  it('sits under the active tab, then slides there with transform only', () => {
    // jsdom has no layout: give each tab a position and width.
    const left = vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return Number(this.dataset.i ?? 0) * 120;
    });
    const width = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(80);
    const { getByTestId, rerender } = render(<Tabs active={0} />);
    const brush = getByTestId('tab-brush');
    expect(brush.style.transform).toBe('translateX(0px) scaleX(0.8)');
    expect(brush.style.transition).toBe('none');

    act(() => rerender(<Tabs active={2} />));
    expect(getByTestId('tab-brush').style.transform).toBe('translateX(240px) scaleX(0.8)');
    expect(getByTestId('tab-brush').style.transition).toContain('transform 280ms');
    left.mockRestore();
    width.mockRestore();
  });
});
