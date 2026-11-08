/**
 * Returns a per-frame callback that calls `onReady` once, on the browser frame after the first one the
 * canvas has rendered (GH#316). `onCreated` fires before anything is drawn, so fading on it would show an
 * empty canvas for a moment; the frame callback runs before the render, and the `requestAnimationFrame`
 * defers the hand-over until that render has been submitted.
 */
export function afterFirstFrame(
  onReady: () => void,
  schedule: (cb: () => void) => void = (cb) => {
    requestAnimationFrame(cb);
  },
): () => void {
  let done = false;
  return () => {
    if (done) return;
    done = true;
    schedule(onReady);
  };
}
