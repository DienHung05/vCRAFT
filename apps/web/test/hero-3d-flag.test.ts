import { describe, expect, it } from 'vitest';
import { canRun3d, type DeviceFacts, HERO_3D_FLAG_SCRIPT } from '@/experience/hero-vase/capability';

const capable: DeviceFacts = {
  reducedMotion: false,
  saveData: false,
  webgl: true,
  cores: 8,
  memoryGb: 8,
  width: 1280,
};

/** Runs the inline script against stubbed browser objects built from the facts; returns whether it set the flag. */
function flagSet(facts: DeviceFacts): boolean {
  let set = false;
  const win = {
    innerWidth: facts.width,
    matchMedia: () => ({ matches: facts.reducedMotion }),
  };
  const nav = {
    hardwareConcurrency: facts.cores,
    deviceMemory: facts.memoryGb,
    connection: { saveData: facts.saveData },
  };
  const doc = {
    createElement: () => ({
      getContext: () =>
        facts.webgl ? { getExtension: () => ({ loseContext: () => undefined }) } : null,
    }),
    documentElement: {
      setAttribute: (name: string) => {
        if (name === 'data-hero-3d') set = true;
      },
    },
  };
  new Function('window', 'navigator', 'document', HERO_3D_FLAG_SCRIPT)(win, nav, doc);
  return set;
}

describe('hero 3D flag script (GH#527)', () => {
  const cases: [string, Partial<DeviceFacts>][] = [
    ['capable desktop', {}],
    ['reduced motion', { reducedMotion: true }],
    ['data saver', { saveData: true }],
    ['no WebGL', { webgl: false }],
    ['few cores', { cores: 2 }],
    ['exactly four cores', { cores: 4 }],
    ['little memory', { memoryGb: 2 }],
    ['unknown memory', { memoryGb: undefined }],
    ['phone width', { width: 390 }],
    ['exactly tablet width', { width: 768 }],
    ['just under tablet width', { width: 767 }],
  ];

  it.each(cases)('matches canRun3d: %s', (_, over) => {
    const facts = { ...capable, ...over };
    expect(flagSet(facts)).toBe(canRun3d(facts));
  });

  it('defaults a missing core count to one core', () => {
    const win = { innerWidth: 1280, matchMedia: () => ({ matches: false }) };
    const nav = { connection: {} };
    let set = false;
    const doc = {
      createElement: () => ({ getContext: () => ({ getExtension: () => null }) }),
      documentElement: { setAttribute: () => (set = true) },
    };
    new Function('window', 'navigator', 'document', HERO_3D_FLAG_SCRIPT)(win, nav, doc);
    expect(set).toBe(false);
  });

  it('never throws when the browser APIs fail', () => {
    const boom = () => {
      throw new Error('boom');
    };
    expect(() =>
      new Function('window', 'navigator', 'document', HERO_3D_FLAG_SCRIPT)(
        { innerWidth: 1280, matchMedia: boom },
        {},
        {},
      ),
    ).not.toThrow();
  });
});
