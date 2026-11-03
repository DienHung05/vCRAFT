import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { canBlink, gazeDirection, MASCOT_MOODS, Mascot, mascotFace, nextBlinkDelay } from '../src';

describe('mascot model', () => {
  it('gives every mood a face', () => {
    for (const mood of MASCOT_MOODS) expect(mascotFace(mood), mood).toBeDefined();
    expect(mascotFace('greet').gesture).toBe('wave');
    expect(mascotFace('sleep').gesture).toBe('zzz');
    expect(mascotFace('refuse')).toMatchObject({ gesture: 'hug', ears: 'back' });
  });

  it('only blinks with open eyes', () => {
    expect(canBlink('idle')).toBe(true);
    expect(canBlink('sleep')).toBe(false);
    expect(canBlink('happy')).toBe(false);
  });

  it('turns the head one of nine ways, straight inside the dead zone', () => {
    const centre = { x: 100, y: 100 };
    expect(gazeDirection(centre, null)).toEqual({ x: 0, y: 0 });
    expect(gazeDirection(centre, { x: 120, y: 90 })).toEqual({ x: 0, y: 0 });
    expect(gazeDirection(centre, { x: 400, y: 10 })).toEqual({ x: 1, y: -1 });
    expect(gazeDirection(centre, { x: 0, y: 300 })).toEqual({ x: -1, y: 1 });
  });

  it('blinks every 3 to 6 seconds', () => {
    expect(nextBlinkDelay(() => 0)).toBe(3_000);
    expect(nextBlinkDelay(() => 0.999)).toBe(5_997);
  });
});

describe('<Mascot>', () => {
  it('is decorative by default and named when given a label', () => {
    expect(renderToStaticMarkup(<Mascot />)).toContain('aria-hidden="true"');
    const named = renderToStaticMarkup(<Mascot label="Cáo, trợ lý của vCraft" />);
    expect(named).toContain('role="img"');
    expect(named).toContain('aria-label="Cáo, trợ lý của vCraft"');
  });

  it('renders at the launcher and panel sizes', () => {
    expect(renderToStaticMarkup(<Mascot size={56} />)).toContain('width="56"');
    expect(renderToStaticMarkup(<Mascot size={96} />)).toContain('width="96"');
  });

  it('shows each mood’s gesture', () => {
    expect(renderToStaticMarkup(<Mascot mood="sleep" />)).toContain('Z</tspan>');
    expect(renderToStaticMarkup(<Mascot mood="confused" />)).toContain('?</text>');
    expect(renderToStaticMarkup(<Mascot mood="greet" />)).toContain('wave');
  });

  it('breathes and animates the bubble only when motion is allowed', () => {
    const moving = renderToStaticMarkup(
      <Mascot mood="think" thought={['Đợi tớ lục lại kho gốm…']} reducedMotion={false} />,
    );
    expect(moving).toContain('data-motion="on"');
    expect(moving).toMatch(/animation:vc-fox-[^;"]*-breathe/);
    expect(moving).toMatch(/animation:vc-fox-[^;"]*-rise/);

    const still = renderToStaticMarkup(
      <Mascot mood="think" thought={['Đợi tớ lục lại kho gốm…']} reducedMotion />,
    );
    expect(still).toContain('data-motion="off"');
    expect(still).not.toMatch(/animation:vc-fox/);
    // The bubble still shows its line, just without effects.
    expect(still).toContain('Đợi tớ lục lại kho gốm…');
  });

  it('has no bubble without a thought', () => {
    expect(renderToStaticMarkup(<Mascot mood="think" />)).not.toContain('rounded-full');
  });
});
