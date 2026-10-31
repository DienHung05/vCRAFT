/**
 * Giờ mở cửa theo tuần của xưởng (FR-ART-05): trạng thái "Đang mở cửa" luôn tính theo giờ Việt Nam
 * (UTC+7, không đổi giờ theo mùa), bất kể múi giờ của máy chủ hay trình duyệt.
 */

/** Một khoảng mở cửa; `day` 0 = Chủ nhật … 6 = Thứ bảy; `open`/`close` dạng `HH:mm`, cùng trong ngày. */
export interface OpeningInterval {
  readonly day: number;
  readonly open: string;
  readonly close: string;
}

export type OpenState =
  | { readonly open: true; readonly closesAt: string }
  | {
      readonly open: false;
      /** Lần mở kế tiếp trong 7 ngày tới; `null` khi không có khoảng nào. */
      readonly reopens: { readonly day: number; readonly at: string } | null;
    };

const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;
const MINUTES_PER_DAY = 24 * 60;

const toMinutes = (time: string): number => {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

/** Khoảng hợp lệ: ngày trong tuần đúng và giờ mở trước giờ đóng. */
export function isValidOpeningInterval(interval: OpeningInterval): boolean {
  return (
    Number.isInteger(interval.day) &&
    interval.day >= 0 &&
    interval.day <= 6 &&
    toMinutes(interval.open) < toMinutes(interval.close)
  );
}

export function openState(hours: readonly OpeningInterval[], now: Date): OpenState {
  const local = new Date(now.getTime() + VIETNAM_OFFSET_MS);
  const today = local.getUTCDay();
  const minute = local.getUTCHours() * 60 + local.getUTCMinutes();

  const current = hours.find(
    (h) => h.day === today && toMinutes(h.open) <= minute && minute < toMinutes(h.close),
  );
  if (current) return { open: true, closesAt: current.close };

  // Khoảng cách (phút) từ bây giờ tới lần mở; khoảng đã qua hôm nay tính sang tuần sau.
  const untilOpen = (h: OpeningInterval): number => {
    const distance = ((h.day - today + 7) % 7) * MINUTES_PER_DAY + toMinutes(h.open) - minute;
    return distance > 0 ? distance : distance + 7 * MINUTES_PER_DAY;
  };
  const next = [...hours].sort((a, b) => untilOpen(a) - untilOpen(b))[0];
  return { open: false, reopens: next ? { day: next.day, at: next.open } : null };
}
