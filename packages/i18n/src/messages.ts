import en from '../messages/en.json';
import vi from '../messages/vi.json';
import type { Locale } from './routing';

export type Messages = typeof vi;

/** Từ điển theo ngôn ngữ. Bản `en` phải cùng cấu trúc khóa với `vi` (kiểm ở test). */
export const messages: Record<Locale, Messages> = { vi, en };
