import type { JournalStage } from '@vcraft/domain';

const STROKES: Record<JournalStage, string> = {
  clay: 'M3 18c1-5 3-9 7-9 2-5 7-3 8 1 3 1 4 4 3 8Z M7 15c2-3 4-3 6-2',
  throw: 'M5 8h14l-2 8H7Z M3 19h18 M12 19v3 M7 4h10',
  dry: 'M5 13h14l-2 7H7Z M12 2v3 M3 6l2 2 M21 6l-2 2 M8 8a4 4 0 0 1 8 0',
  paint: 'm14 3 7 3-9 11-4-3Z M8 14c-4 0-2 6-6 7 5 1 9-2 9-5',
  glaze: 'M4 14h16l-2 7H6Z M12 2s-4 5-4 7a4 4 0 0 0 8 0c0-2-4-7-4-7Z',
  fire: 'M4 21V10a8 8 0 0 1 16 0v11Z M9 17c-2-3 3-4 3-8 5 4 6 8 2 10-2 1-4 0-5-2Z',
  finish: 'M5 10h14l-2 10H7Z M8 5l3 3 6-6',
};

/** The same seven production stages in the journal and its compact product summary. */
export function StageIcon({ stage, className }: { stage: JournalStage; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d={STROKES[stage]} />
    </svg>
  );
}
