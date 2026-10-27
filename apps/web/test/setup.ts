import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom chưa cài <dialog>.showModal()/close(); giả lập vừa đủ để thử hộp thoại xác nhận.
HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
  this.setAttribute('open', '');
};
HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
  this.removeAttribute('open');
};

afterEach(cleanup);
