import { JOURNAL_STAGES, type JournalStage } from '@vcraft/domain';

/** Where the focus line sits in the viewport, as a share of its height from the top. */
export const FOCUS_LINE = 0.45;

/** The step in focus: the last one whose top has reached the focus line, or the first before any has. */
export function focusedStep(tops: readonly number[], line: number): number {
  let focused = 0;
  tops.forEach((top, index) => {
    if (top <= line) focused = index;
  });
  return focused;
}

/** How far the heat has climbed the connector (0 to 1): the share of the list above the focus line. */
export function heatProgress(listTop: number, listHeight: number, line: number): number {
  if (listHeight <= 0) return 0;
  return Math.min(1, Math.max(0, (line - listTop) / listHeight));
}

/**
 * For each journal stage, the index of the first step that recorded it, or -1 when the journal has no entry
 * for it (the step list can hold several entries of one stage after a correction).
 */
export function recordedAt(entryStages: readonly JournalStage[]): Record<JournalStage, number> {
  const at = {} as Record<JournalStage, number>;
  for (const stage of JOURNAL_STAGES) at[stage] = entryStages.indexOf(stage);
  return at;
}
