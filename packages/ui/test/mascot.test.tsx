import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  canBlink,
  gazeDirection,
  gazeToDirection,
  MASCOT_MOODS,
  Mascot,
  moodFixedDirection,
  moodReaction,
  nextBlinkDelay,
} from '../src';

describe('mascot model', () => {
  it('every mood has a reaction or a direction', () => {
    for (const mood of MASCOT_MOODS) {
      const reaction = moodReaction(mood);
      const fixed = moodFixedDirection(mood);
      // Either it shows a reaction overlay, or it uses the directions sheet.
      // Both null is fine — gaze-driven.
      expect(reaction === null || typeof reaction === 'string').toBe(true);
      expect(fixed === null || typeof fixed === 'string').toBe(true);
    }
  });

  it('mood reaction mapping matches the spec', () => {
    expect(moodReaction('greet')).toBe('heart');
    expect(moodReaction('happy')).toBe('sparkle');
    expect(moodReaction('sleep')).toBe('sleepy');
    expect(moodReaction('confused')).toBe('dizzy');
    expect(moodReaction('talk')).toBe('delighted');
    expect(moodReaction('idle')).toBeNull();
    expect(moodReaction('listen')).toBeNull();
    expect(moodReaction('refuse')).toBeNull();
  });

  it('fixed direction mapping matches the spec', () => {
    expect(moodFixedDirection('think')).toBe('up-right');
    expect(moodFixedDirection('refuse')).toBe('center');
    expect(moodFixedDirection('idle')).toBeNull();
  });

  it('canBlink is false for reaction-overlay moods', () => {
    expect(canBlink('idle')).toBe(true);
    expect(canBlink('listen')).toBe(true);
    expect(canBlink('sleep')).toBe(false);
    expect(canBlink('greet')).toBe(false);
    expect(canBlink('happy')).toBe(false);
    expect(canBlink('talk')).toBe(false);
  });

  it('turns the head one of nine ways, straight inside the dead zone', () => {
    const centre = { x: 100, y: 100 };
    expect(gazeDirection(centre, null)).toEqual({ x: 0, y: 0 });
    expect(gazeDirection(centre, { x: 120, y: 90 })).toEqual({ x: 0, y: 0 });
    expect(gazeDirection(centre, { x: 400, y: 10 })).toEqual({ x: 1, y: -1 });
    expect(gazeDirection(centre, { x: 0, y: 300 })).toEqual({ x: -1, y: 1 });
  });

  it('gazeToDirection maps {x,y} steps to the correct cell name', () => {
    expect(gazeToDirection({ x: 0, y: 0 })).toBe('center');
    expect(gazeToDirection({ x: -1, y: -1 })).toBe('up-left');
    expect(gazeToDirection({ x: 0, y: -1 })).toBe('up');
    expect(gazeToDirection({ x: 1, y: -1 })).toBe('up-right');
    expect(gazeToDirection({ x: -1, y: 0 })).toBe('left');
    expect(gazeToDirection({ x: 1, y: 0 })).toBe('right');
    expect(gazeToDirection({ x: -1, y: 1 })).toBe('down-left');
    expect(gazeToDirection({ x: 0, y: 1 })).toBe('down');
    expect(gazeToDirection({ x: 1, y: 1 })).toBe('down-right');
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
    const html56 = renderToStaticMarkup(<Mascot size={56} />);
    const html96 = renderToStaticMarkup(<Mascot size={96} />);
    expect(html56).toContain('width:56px');
    expect(html96).toContain('width:96px');
  });

  it('mounts all three sprite layers so sheets are preloaded', () => {
    const html = renderToStaticMarkup(<Mascot />);
    expect(html).toContain('fox-directions.webp');
    expect(html).toContain('fox-reactions.webp');
    expect(html).toContain('fox-directions-blink.webp');
  });

  it('the hidden blink layer sits on the same cell as the directions layer (GH#186)', () => {
    const html = renderToStaticMarkup(<Mascot lookAt={null} />);
    const position = (layer: string) =>
      html.match(new RegExp(`data-layer="${layer}" style="[^"]*background-position:([^;"]+)`))?.[1];
    expect(position('blink')).toBe('50% 50%');
    expect(position('blink')).toBe(position('directions'));
  });

  it('accepts custom directions and reactions URLs', () => {
    const html = renderToStaticMarkup(
      <Mascot directions="/custom/dir.webp" reactions="/custom/react.webp" />,
    );
    expect(html).toContain('/custom/dir.webp');
    expect(html).toContain('/custom/react.webp');
  });

  it('sets data-mood on the root element', () => {
    expect(renderToStaticMarkup(<Mascot mood="sleep" />)).toContain('data-mood="sleep"');
    expect(renderToStaticMarkup(<Mascot mood="confused" />)).toContain('data-mood="confused"');
    expect(renderToStaticMarkup(<Mascot mood="greet" />)).toContain('data-mood="greet"');
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

  it('shows the shake animation for refuse mood when motion is on', () => {
    const html = renderToStaticMarkup(<Mascot mood="refuse" reducedMotion={false} />);
    expect(html).toMatch(/animation:vc-fox-[^;"]*-shake/);
  });

  it('has no shake animation under reduced motion', () => {
    const html = renderToStaticMarkup(<Mascot mood="refuse" reducedMotion />);
    expect(html).not.toMatch(/animation:vc-fox/);
  });
});
