'use client';

import type { SlugCheckState } from './use-slug-availability';

export interface SlugNoteLabels {
  checking: string;
  available: string;
  taken: string;
  takenSuggest: (slug: string) => string;
  applySuggestion: (slug: string) => string;
  failed: string;
}

/** The result of the live address check, with a one-click alternative when the address is taken. */
export function SlugAvailabilityNote({
  state,
  labels,
  onUseSuggestion,
}: {
  state: SlugCheckState;
  labels: SlugNoteLabels;
  onUseSuggestion: (slug: string) => void;
}) {
  if (state.status === 'idle') return null;
  if (state.status === 'taken') {
    return (
      <p role="status" className="flex flex-wrap items-center gap-2 text-small text-seal">
        <span>{state.suggestion ? labels.takenSuggest(state.suggestion) : labels.taken}</span>
        {state.suggestion ? (
          <button
            type="button"
            className="rounded-input border border-ink/20 px-2 py-0.5 text-ink hover:bg-ink/6"
            onClick={() => onUseSuggestion(state.suggestion ?? '')}
          >
            {labels.applySuggestion(state.suggestion)}
          </button>
        ) : null}
      </p>
    );
  }
  const text =
    state.status === 'checking'
      ? labels.checking
      : state.status === 'available'
        ? labels.available
        : labels.failed;
  return (
    <p role="status" className="text-small text-ash">
      {text}
    </p>
  );
}
