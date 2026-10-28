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

afterEach(cleanup);
