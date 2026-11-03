/** What the browser tells us before the 3D vase is allowed to load (GH#94). */
export interface DeviceFacts {
  reducedMotion: boolean;
  saveData: boolean;
  webgl: boolean;
  cores: number;
  /** `navigator.deviceMemory`, missing outside Chromium. */
  memoryGb?: number | undefined;
  width: number;
}

/**
 * The 3D vase runs only where it costs nothing that matters: motion allowed, no data saver, WebGL, at
 * least 4 cores and (where known) 4 GB of memory, and a tablet-or-wider screen. Phones keep the poster
 * photo, which is also the LCP image, so the mobile Lighthouse score is untouched.
 */
export function canRun3d(facts: DeviceFacts): boolean {
  return (
    !facts.reducedMotion &&
    !facts.saveData &&
    facts.webgl &&
    facts.cores >= 4 &&
    (facts.memoryGb === undefined || facts.memoryGb >= 4) &&
    facts.width >= 768
  );
}

/** Reads the facts from the live browser. */
export function readDeviceFacts(): DeviceFacts {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  let webgl = false;
  try {
    webgl = Boolean(document.createElement('canvas').getContext('webgl2'));
  } catch {
    webgl = false;
  }
  return {
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    saveData: nav.connection?.saveData === true,
    webgl,
    cores: nav.hardwareConcurrency ?? 1,
    memoryGb: nav.deviceMemory,
    width: window.innerWidth,
  };
}
