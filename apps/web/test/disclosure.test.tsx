import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Disclosure } from '@/components/shell/disclosure';

let pathname = '/vi/san-pham';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

function ui() {
  return (
    <Disclosure summary="Menu">
      <a href="/vi/nghe-nhan">Nghệ nhân</a>
    </Disclosure>
  );
}

beforeEach(() => {
  pathname = '/vi/san-pham';
});

describe('Disclosure (GH#432)', () => {
  it('closes when the pathname changes after a client-side navigation', () => {
    const { container, rerender } = render(ui());
    const details = container.querySelector('details') as HTMLDetailsElement;
    details.open = true;
    rerender(ui());
    expect(details.open).toBe(true);
    pathname = '/vi/nghe-nhan';
    rerender(ui());
    expect(details.open).toBe(false);
  });
});
