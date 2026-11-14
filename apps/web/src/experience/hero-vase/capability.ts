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
 * least 4 cores and (where known) 4 GB of memory, and a tablet-or-wider screen. Phones keep the CSS turning vase
 * (GH#316), so three.js never loads there and the mobile Lighthouse score is untouched.
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
    const gl = document.createElement('canvas').getContext('webgl2');
    webgl = Boolean(gl);
    // Release the probe context at once so it does not count against the browser's context limit.
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
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

/**
 * A constant ES5 script that runs in the page `<head>`/body before the hero is parsed (GH#527). It
 * computes the same facts as `readDeviceFacts` and the same predicate as `canRun3d`, and when the 3D vase
 * can run it sets `data-hero-3d` on `<html>`. CSS then hides the server-rendered SVG vase before first
 * paint, so a 3D-capable device never shows the SVG story and the WebGL one.
 * It MUST stay in sync with `canRun3d` and `readDeviceFacts`; `test/hero-3d-flag.test.ts` checks that.
 */
export const HERO_3D_FLAG_SCRIPT = `(function(){try{
var n=navigator,w=window,ok=true;
if(w.matchMedia('(prefers-reduced-motion: reduce)').matches)ok=false;
if(n.connection&&n.connection.saveData===true)ok=false;
if((n.hardwareConcurrency===undefined||n.hardwareConcurrency===null?1:n.hardwareConcurrency)<4)ok=false;
if(n.deviceMemory!==undefined&&!(n.deviceMemory>=4))ok=false;
if(!(w.innerWidth>=768))ok=false;
if(ok){
var gl=document.createElement('canvas').getContext('webgl2');
if(!gl)ok=false;
else{var e=gl.getExtension('WEBGL_lose_context');if(e)e.loseContext();}
}
if(ok)document.documentElement.setAttribute('data-hero-3d','');
}catch(e){}})();`;
