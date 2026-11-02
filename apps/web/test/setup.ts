import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom chưa cài <dialog>.showModal()/close(); giả lập vừa đủ để thử hộp thoại xác nhận.
// Test chạy môi trường `node` (`// @vitest-environment node`) không có DOM nên bỏ qua.
if (typeof HTMLDialogElement !== 'undefined') {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
}

// jsdom does no layout, so Range has no getClientRects/getBoundingClientRect. ProseMirror calls
// them from EditorView.scrollToSelection, which tiptap's focus() command schedules in a
// requestAnimationFrame; without these the callback throws "getClientRects is not a function"
// whenever it lands after the test body (an unhandled error that fails the whole run).
// Return empty geometry, which is what a layout-less DOM would report.
if (typeof Range !== 'undefined') {
  const emptyRect = () => new DOMRect(0, 0, 0, 0);
  if (!Range.prototype.getClientRects) {
    Range.prototype.getClientRects = function getClientRects(this: Range) {
      return Object.assign([], { item: () => null }) as unknown as DOMRectList;
    };
  }
  if (!Range.prototype.getBoundingClientRect) {
    Range.prototype.getBoundingClientRect = emptyRect;
  }
}

afterEach(cleanup);
