import { type MediaAssetResponse, MediaAssetResponseSchema } from '@vcraft/contracts';
import type { PreparedImage } from './upload-queue';

const MAX_EDGE_PX = 2560;
const MAX_SIZE_MB = 9.5;

const isHeic = (file: File) => /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);

async function readCapturedAt(file: File): Promise<Date | null> {
  try {
    const { parse } = await import('exifr');
    const tags = (await parse(file, ['DateTimeOriginal', 'CreateDate'])) as
      | { DateTimeOriginal?: Date; CreateDate?: Date }
      | undefined;
    return tags?.DateTimeOriginal ?? tags?.CreateDate ?? null;
  } catch {
    return null;
  }
}

/**
 * Xử lý phía trình duyệt trước khi tải lên (FR-MEDIA-02): đọc ngày chụp EXIF trước (server sẽ xóa
 * EXIF), đổi HEIC sang JPEG, thu cạnh dài về tối đa 2560 px. Các thư viện nặng chỉ nạp khi cần.
 */
export async function prepareImage(file: File, signal: AbortSignal): Promise<PreparedImage> {
  const capturedAt = await readCapturedAt(file);
  let current = file;
  if (isHeic(file)) {
    const { default: heic2any } = await import('heic2any');
    const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
    current = new File(
      [Array.isArray(converted) ? (converted[0] as Blob) : converted],
      file.name.replace(/\.[^.]+$/, '.jpg'),
      { type: 'image/jpeg' },
    );
  }
  const { default: imageCompression } = await import('browser-image-compression');
  const resized = await imageCompression(current, {
    maxWidthOrHeight: MAX_EDGE_PX,
    maxSizeMB: MAX_SIZE_MB,
    useWebWorker: true,
    signal,
    fileType: current.type,
    preserveExif: false,
  });
  return {
    file: new File([resized], current.name, { type: current.type }),
    capturedAt,
  };
}

/** Tải qua XHR vì `fetch` chưa báo tiến độ gửi; `POST /media` trả 202 khi còn chờ worker. */
export function sendMedia(
  file: File,
  purpose: string,
  getAccessToken: () => Promise<string | null>,
  onProgress: (percent: number) => void,
  signal: AbortSignal,
): Promise<MediaAssetResponse> {
  return new Promise((resolve, reject) => {
    void getAccessToken().then((token) => {
      if (!token) {
        reject(new Error('unauthenticated'));
        return;
      }
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `/api/v1/media?purpose=${encodeURIComponent(purpose)}`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status < 200 || xhr.status >= 300) {
          reject(new Error(String(xhr.status)));
          return;
        }
        try {
          resolve(MediaAssetResponseSchema.parse(JSON.parse(xhr.responseText)));
        } catch (error) {
          reject(error);
        }
      };
      xhr.onerror = () => reject(new Error('network'));
      xhr.onabort = () => reject(new DOMException('aborted', 'AbortError'));
      signal.addEventListener('abort', () => xhr.abort());
      const form = new FormData();
      form.append('file', file);
      xhr.send(form);
    }, reject);
  });
}
