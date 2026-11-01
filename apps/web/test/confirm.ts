import { fireEvent, within } from '@testing-library/react';

/** The confirmation dialog that is currently open (the `<dialog>` mock in `setup.ts` sets `open`). */
export function openDialog(): HTMLElement {
  const dialog = document.querySelector('dialog[open]');
  if (!(dialog instanceof HTMLElement)) throw new Error('No confirmation dialog is open');
  return dialog;
}

/** Presses a button of the open confirmation dialog, e.g. `confirmDialog('Duyệt')`. */
export function confirmDialog(name: string | RegExp): void {
  fireEvent.click(within(openDialog()).getByRole('button', { name, hidden: true }));
}
