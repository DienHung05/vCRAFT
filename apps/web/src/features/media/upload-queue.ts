/** Hàng đợi tải ảnh (FR-MEDIA-01): tối đa 4 luồng song song, tiến độ, hủy và thử lại từng ảnh. */

export const MAX_PARALLEL_UPLOADS = 4;

export type UploadStatus = 'queued' | 'preparing' | 'uploading' | 'done' | 'failed' | 'cancelled';

export interface UploadItem<R> {
  id: string;
  file: File;
  name: string;
  status: UploadStatus;
  /** 0–100. */
  progress: number;
  /** Ngày chụp đọc từ EXIF trước khi server xóa EXIF (FR-MEDIA-02). */
  capturedAt: Date | null;
  result: R | null;
}

export interface PreparedImage {
  file: File;
  capturedAt: Date | null;
}

export interface UploadDeps<R> {
  prepare: (file: File, signal: AbortSignal) => Promise<PreparedImage>;
  send: (file: File, onProgress: (percent: number) => void, signal: AbortSignal) => Promise<R>;
}

/** Không phụ thuộc React để kiểm thử được; `onChange` nhận ảnh chụp danh sách mới sau mỗi thay đổi. */
export class UploadQueue<R> {
  private items: UploadItem<R>[] = [];
  private readonly controllers = new Map<string, AbortController>();
  private sequence = 0;

  constructor(
    private readonly deps: UploadDeps<R>,
    private readonly onChange: (items: readonly UploadItem<R>[]) => void,
    private readonly limit = Number.POSITIVE_INFINITY,
  ) {}

  /** Thêm tệp, bỏ phần vượt giới hạn; trả số tệp bị bỏ để giao diện báo lại. */
  add(files: readonly File[]): number {
    const active = this.items.filter((i) => i.status !== 'cancelled' && i.status !== 'failed');
    const room = Math.max(0, this.limit - active.length);
    const accepted = files.slice(0, room);
    for (const file of accepted) {
      this.items.push({
        id: `upload-${++this.sequence}`,
        file,
        name: file.name,
        status: 'queued',
        progress: 0,
        capturedAt: null,
        result: null,
      });
    }
    this.publish();
    this.pump();
    return files.length - accepted.length;
  }

  cancel(id: string): void {
    this.controllers.get(id)?.abort();
    this.patch(id, { status: 'cancelled' });
    this.pump();
  }

  retry(id: string): void {
    this.patch(id, { status: 'queued', progress: 0, result: null });
    this.pump();
  }

  remove(id: string): void {
    this.controllers.get(id)?.abort();
    this.items = this.items.filter((i) => i.id !== id);
    this.publish();
    this.pump();
  }

  private patch(id: string, change: Partial<UploadItem<R>>): void {
    this.items = this.items.map((i) => (i.id === id ? { ...i, ...change } : i));
    this.publish();
  }

  private publish(): void {
    this.onChange(this.items);
  }

  private pump(): void {
    const running = this.items.filter(
      (i) => i.status === 'preparing' || i.status === 'uploading',
    ).length;
    const waiting = this.items.filter((i) => i.status === 'queued');
    for (const item of waiting.slice(0, Math.max(0, MAX_PARALLEL_UPLOADS - running))) {
      void this.run(item.id, item.file);
    }
  }

  private async run(id: string, file: File): Promise<void> {
    const controller = new AbortController();
    this.controllers.set(id, controller);
    const { signal } = controller;
    this.patch(id, { status: 'preparing' });
    try {
      const prepared = await this.deps.prepare(file, signal);
      if (signal.aborted) return;
      this.patch(id, { status: 'uploading', capturedAt: prepared.capturedAt });
      const result = await this.deps.send(
        prepared.file,
        (progress) => {
          if (!signal.aborted) this.patch(id, { progress });
        },
        signal,
      );
      if (signal.aborted) return;
      this.patch(id, { status: 'done', progress: 100, result });
    } catch {
      if (!signal.aborted) this.patch(id, { status: 'failed' });
    } finally {
      this.controllers.delete(id);
      this.pump();
    }
  }
}
