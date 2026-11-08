import type { JournalStage } from '@vcraft/domain';

/** One small stroke icon per journal stage, on a 24-unit grid. Decorative: the stage name always sits beside it. */
const ICONS: Record<JournalStage, string> = {
  clay: 'M4 18c0-5 3-9 8-9s8 4 8 9z',
  throw: 'M8 4h8l-1 5c3 1 4 3 4 5H5c0-2 1-4 4-5z M4 19h16',
  dry: 'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z M12 3v2.5 M12 18.5V21 M3 12h2.5 M18.5 12H21 M5.6 5.6l1.8 1.8 M16.6 16.6l1.8 1.8 M5.6 18.4l1.8-1.8 M16.6 7.4l1.8-1.8',
  paint: 'M18 3l3 3-9 9-3-3z M9 12c-3 0-4 2-4 4 0 2-1 3-2 4 3 1 7 0 7-3',
  glaze: 'M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z',
  fire: 'M12 3c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-10z',
  finish: 'M5 12.5l4.5 4.5L19 7',
};

export function StageIcon({ stage, size = 14 }: { stage: JournalStage; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      data-stage-icon={stage}
    >
      <path d={ICONS[stage]} />
    </svg>
  );
}
