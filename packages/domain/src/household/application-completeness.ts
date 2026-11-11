/**
 * Hồ sơ đăng ký tối thiểu để Ban quản lý được phép duyệt (FR-ADM-03, GH#474): có câu chuyện, có nghề
 * và có ít nhất một nghệ nhân. Khác `profileCompleteness` (độ hoàn thiện hồ sơ công khai), đây là ngưỡng
 * chặn: thiếu một mục thì không được duyệt, tránh một hộ trống trơn xuất hiện công khai.
 */
export const APPLICATION_APPROVAL_PARTS = ['story', 'craft', 'artisans'] as const;
export type ApplicationApprovalPart = (typeof APPLICATION_APPROVAL_PARTS)[number];

export interface ApplicationFacts {
  readonly history: string;
  /** Nghề chọn từ danh sách cố định (FR-ART-01). */
  readonly craftCategory: string | null;
  /** Nghề ghi bằng chữ; hộ cũ chỉ có mục này. */
  readonly craft: string | null;
  readonly artisanCount: number;
}

/** Danh sách mục bắt buộc còn thiếu để duyệt; rỗng nghĩa là hồ sơ đủ điều kiện duyệt. */
export function missingApplicationParts(facts: ApplicationFacts): ApplicationApprovalPart[] {
  const done: Record<ApplicationApprovalPart, boolean> = {
    story: facts.history.trim().length > 0,
    craft: facts.craftCategory !== null || (facts.craft ?? '').trim().length > 0,
    artisans: facts.artisanCount > 0,
  };
  return APPLICATION_APPROVAL_PARTS.filter((part) => !done[part]);
}
