import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QrLabelsButton } from '@/features/studio/qr-labels-button';
import { renderVi } from './render';

const REQUEST = '00000000-0000-4000-8000-0000000000ab';

describe('QrLabelsButton', () => {
  const open = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('open', open);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    open.mockReset();
  });

  it('requests the sheet, polls until it is ready, then opens the PDF', async () => {
    const client = {
      requestQrLabels: vi.fn(async () => ({ requestId: REQUEST, status: 'PENDING', url: null })),
      qrLabelsStatus: vi
        .fn()
        .mockResolvedValueOnce({ requestId: REQUEST, status: 'PENDING', url: null })
        .mockResolvedValueOnce({
          requestId: REQUEST,
          status: 'READY',
          url: 'https://s/labels.pdf',
        }),
    };
    renderVi(
      <QrLabelsButton
        client={client as never}
        productIds={['p1', 'p2']}
        copies={2}
        label="In nhãn"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'In nhãn' }));
    expect(client.requestQrLabels).toHaveBeenCalledWith({ productIds: ['p1', 'p2'], copies: 2 });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_100);
    });
    expect(client.qrLabelsStatus).toHaveBeenCalledTimes(2);
    expect(open).toHaveBeenCalledWith('https://s/labels.pdf', '_blank', 'noopener');
  });

  it('says so when the request fails', async () => {
    const client = {
      requestQrLabels: vi.fn(async () => {
        throw new Error('boom');
      }),
      qrLabelsStatus: vi.fn(),
    };
    renderVi(<QrLabelsButton client={client as never} productIds={['p1']} label="In nhãn" />);
    fireEvent.click(screen.getByRole('button', { name: 'In nhãn' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(screen.getByRole('alert').textContent).toContain('Chưa dựng được tờ nhãn');
  });
});
