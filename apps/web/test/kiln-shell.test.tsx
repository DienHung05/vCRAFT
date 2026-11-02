import { fireEvent, render, screen } from '@testing-library/react';
import { messages } from '@vcraft/i18n';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthShell } from '@/features/auth/auth-shell';
import { TextField } from '@/features/auth/fields';
import { KilnStage } from '@/features/auth/kiln/kiln-stage';
import { KilnSurface } from '@/features/auth/kiln/kiln-surface';
import { renderVi } from './render';

vi.mock('next/dynamic', () => ({
  // The WebGL island is a lazy chunk; these tests only need the static scene.
  default: () => () => null,
}));

describe('AuthShell (kiln shell)', () => {
  it('renders exactly one h1, with the lead, inside the glazed card together with the children', () => {
    const { container } = renderVi(
      <AuthShell title="Đăng nhập" lead="Vào vCraft để theo dõi yêu cầu báo giá.">
        <form aria-label="demo">
          <button type="submit">Gửi</button>
        </form>
      </AuthShell>,
    );
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    const card = container.querySelector('.kiln-card');
    expect(card).not.toBeNull();
    expect(card?.contains(headings[0] ?? null)).toBe(true);
    expect(card?.contains(screen.getByText('Vào vCraft để theo dõi yêu cầu báo giá.'))).toBe(true);
    expect(card?.contains(screen.getByRole('form', { name: 'demo' }))).toBe(true);
  });

  it('shows the footer tagline without its trailing full stop, and the small line under it', () => {
    renderVi(
      <AuthShell title="Đăng nhập">
        <p>x</p>
      </AuthShell>,
    );
    expect(messages.vi.footer.tagline.endsWith('.')).toBe(true);
    expect(screen.getByText(messages.vi.footer.tagline.slice(0, -1))).toBeTruthy();
    expect(screen.getByText(messages.vi.home.hero.title)).toBeTruthy();
  });

  it('keeps every decorative layer out of the accessibility tree', () => {
    const { container } = renderVi(
      <KilnStage>
        <AuthShell title="Đăng nhập">
          <p>x</p>
        </AuthShell>
      </KilnStage>,
    );
    const scene = container.querySelector('.kiln-scene');
    for (const art of scene?.querySelectorAll(
      'svg, .kiln-seal, .kiln-card-layer:not(.kiln-stamp), .kiln-stamp-stage',
    ) ?? []) {
      const hidden = art.closest('[aria-hidden="true"]');
      expect(
        hidden,
        `${art.getAttribute('class') ?? art.tagName} must be aria-hidden`,
      ).not.toBeNull();
    }
    expect(container.querySelectorAll('.brush-orn').length).toBeGreaterThan(0);
    // The one layer that is not hidden is the success line: an empty live region, ready to announce.
    const status = container.querySelector('.kiln-stamp [role="status"]');
    expect(status?.textContent).toBe('');
    expect(status?.getAttribute('data-text')).toBe(messages.vi.auth.kiln.sealed);
  });

  it('the stage is one scene with a small static backdrop; the page only brings seal and card', () => {
    const { container } = renderVi(
      <KilnStage>
        <AuthShell title="a">
          <p>x</p>
        </AuthShell>
      </KilnStage>,
    );
    expect(container.querySelectorAll('.kiln-scene')).toHaveLength(1);
    const art = container.querySelector('.kiln-scene > [aria-hidden="true"]');
    expect(art?.innerHTML.length ?? Number.POSITIVE_INFINITY).toBeLessThan(8 * 1024);
    // AuthShell alone has no scene of its own.
    const bare = renderVi(
      <AuthShell title="a">
        <p>x</p>
      </AuthShell>,
    );
    expect(bare.container.querySelector('.kiln-scene')).toBeNull();
  });

  it('wide: leaves the vine and lotus out and widens the card', () => {
    const narrow = renderVi(
      <AuthShell title="a">
        <p>x</p>
      </AuthShell>,
    );
    const narrowCount = narrow.container.querySelectorAll('.brush-orn').length;
    narrow.unmount();
    const wide = renderVi(
      <AuthShell title="a" wide>
        <p>x</p>
      </AuthShell>,
    );
    expect(wide.container.querySelectorAll('.brush-orn').length).toBeLessThan(narrowCount);
    expect(wide.container.querySelector('.max-w-3xl')).not.toBeNull();
  });

  it('hooks every field frame for the ember underline without touching the input', () => {
    const { container } = renderVi(<TextField label="Email" type="email" autoComplete="email" />);
    const input = screen.getByLabelText('Email');
    expect(input.getAttribute('autocomplete')).toBe('email');
    expect(input.closest('.kiln-field')).not.toBeNull();
    expect(input.parentElement?.classList.contains('kiln-control')).toBe(true);
    expect(container.querySelectorAll('input')).toHaveLength(1);
  });
});

describe('KilnSurface pointer sheen', () => {
  const frames: FrameRequestCallback[] = [];

  function stubMedia(matches: Record<string, boolean>) {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: matches[query] ?? false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
  }

  function setup() {
    const { container } = render(
      <KilnSurface className="kiln-card">
        <p>inside</p>
      </KilnSurface>,
    );
    const host = container.firstElementChild as HTMLElement;
    const sheen = host.querySelector('.kiln-sheen-glow') as HTMLElement;
    return { host, sheen };
  }

  function flush() {
    for (const frame of frames.splice(0)) frame(0);
  }

  beforeEach(() => {
    frames.length = 0;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });
  afterEach(() => vi.unstubAllGlobals());

  it('moves the sheen with a fine pointer, throttled to one write per frame', () => {
    stubMedia({
      '(hover: hover) and (pointer: fine)': true,
      '(prefers-reduced-motion: reduce)': false,
    });
    const { host, sheen } = setup();
    fireEvent.pointerMove(host, { clientX: 40, clientY: 60 });
    fireEvent.pointerMove(host, { clientX: 90, clientY: 120 });
    expect(frames).toHaveLength(1);
    flush();
    expect(sheen.style.transform).toMatch(/^translate3d\(.*px, .*px, 0\)$/);
    fireEvent.pointerLeave(host);
    expect(sheen.style.transform).toBe('');
  });

  it('is a no-op for coarse pointers', () => {
    stubMedia({
      '(hover: hover) and (pointer: fine)': false,
      '(prefers-reduced-motion: reduce)': false,
    });
    const { host, sheen } = setup();
    fireEvent.pointerMove(host, { clientX: 40, clientY: 60 });
    expect(frames).toHaveLength(0);
    expect(sheen.style.transform).toBe('');
  });

  it('is a no-op when reduced motion is requested', () => {
    stubMedia({
      '(hover: hover) and (pointer: fine)': true,
      '(prefers-reduced-motion: reduce)': true,
    });
    const { host, sheen } = setup();
    fireEvent.pointerMove(host, { clientX: 40, clientY: 60 });
    expect(frames).toHaveLength(0);
    expect(sheen.style.transform).toBe('');
  });

  it('renders its children untouched and does nothing without matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined);
    const { host } = setup();
    expect(host.textContent).toBe('inside');
  });
});
