import { describe, expect, it, vi } from 'vitest';
import { MAX_PARALLEL_UPLOADS, type UploadItem, UploadQueue } from '@/features/media/upload-queue';

const file = (name: string) => new File(['x'], name, { type: 'image/jpeg' });

function setup(limit?: number) {
  const pending: { resolve: (value: string) => void; reject: (e: Error) => void; name: string }[] =
    [];
  const capturedAt = new Date('2026-09-01T08:00:00Z');
  let items: readonly UploadItem<string>[] = [];
  const queue = new UploadQueue<string>(
    {
      prepare: vi.fn(async (f: File) => ({ file: f, capturedAt })),
      send: vi.fn(
        (f: File, onProgress: (n: number) => void) =>
          new Promise<string>((resolve, reject) => {
            onProgress(40);
            pending.push({ resolve, reject, name: f.name });
          }),
      ),
    },
    (next) => {
      items = next;
    },
    limit,
  );
  return { queue, pending, items: () => items, capturedAt };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('UploadQueue (FR-MEDIA-01)', () => {
  it('chỉ chạy tối đa 4 luồng; xong một ảnh thì ảnh chờ được chạy', async () => {
    const { queue, pending } = setup();
    queue.add(Array.from({ length: 6 }, (_, i) => file(`${i}.jpg`)));
    await flush();
    expect(pending).toHaveLength(MAX_PARALLEL_UPLOADS);
    pending[0]?.resolve('ok');
    await flush();
    expect(pending).toHaveLength(MAX_PARALLEL_UPLOADS + 1);
  });

  it('ghi tiến độ, ngày chụp EXIF và kết quả', async () => {
    const { queue, pending, items, capturedAt } = setup();
    queue.add([file('a.jpg')]);
    await flush();
    expect(items()[0]).toMatchObject({ status: 'uploading', progress: 40, capturedAt });
    pending[0]?.resolve('media-1');
    await flush();
    expect(items()[0]).toMatchObject({ status: 'done', progress: 100, result: 'media-1' });
  });

  it('lỗi thì thử lại được từng ảnh', async () => {
    const { queue, pending, items } = setup();
    queue.add([file('a.jpg')]);
    await flush();
    pending[0]?.reject(new Error('mạng'));
    await flush();
    expect(items()[0]?.status).toBe('failed');
    queue.retry(items()[0]?.id as string);
    await flush();
    expect(pending).toHaveLength(2);
    pending[1]?.resolve('ok');
    await flush();
    expect(items()[0]?.status).toBe('done');
  });

  it('hủy một ảnh nhường chỗ cho ảnh chờ và không ghi kết quả về sau', async () => {
    const { queue, pending, items } = setup();
    queue.add(Array.from({ length: 5 }, (_, i) => file(`${i}.jpg`)));
    await flush();
    const first = items()[0]?.id as string;
    queue.cancel(first);
    await flush();
    expect(items()[0]?.status).toBe('cancelled');
    expect(pending).toHaveLength(5);
    pending[0]?.resolve('muộn');
    await flush();
    expect(items()[0]?.status).toBe('cancelled');
  });

  it('bỏ phần vượt giới hạn 12 ảnh và báo số bị bỏ', () => {
    const { queue, items } = setup(12);
    expect(queue.add(Array.from({ length: 14 }, (_, i) => file(`${i}.jpg`)))).toBe(2);
    expect(items()).toHaveLength(12);
  });
});
