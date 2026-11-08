import { FOCUS_LINE, focusedStep, heatProgress } from './fire-story-math';

/**
 * The scroll side of the trace page story, loaded only after hydration on wide screens with motion allowed
 * (GH#300). One passive scroll listener, throttled to a frame: it reads the step positions, reports the step in
 * focus (only when it changes, so React does not re-render per frame) and scales the heat line with a
 * `transform` write straight to the element, never through state.
 */
export function trackFireStory({
  steps,
  list,
  heat,
  onFocus,
}: {
  steps: readonly HTMLElement[];
  list: HTMLElement;
  heat: HTMLElement | null;
  onFocus: (index: number) => void;
}): () => void {
  let frame = 0;
  let last = -1;
  const update = () => {
    frame = 0;
    const line = window.innerHeight * FOCUS_LINE;
    const index = focusedStep(
      steps.map((step) => step.getBoundingClientRect().top),
      line,
    );
    if (index !== last) {
      last = index;
      onFocus(index);
    }
    if (heat) {
      const box = list.getBoundingClientRect();
      heat.style.transform = `scaleY(${heatProgress(box.top, box.height, line)})`;
    }
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  update();
  return () => {
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    if (frame) cancelAnimationFrame(frame);
    if (heat) heat.style.transform = '';
  };
}
