import { DomainError } from '../shared/domain-error';
import { err, ok, type Result } from '../shared/result';

/**
 * Luật nhật ký sản xuất (vCRAFT-9hg.4, GLOSSARY: Production journal, Journal entry, Correction entry).
 *
 * - Bảy công đoạn gốm cố định; công đoạn được lặp hoặc bỏ qua, bỏ qua phải ghi một dòng lý do.
 * - Trước lần xuất bản đầu tiên hộ sửa/xóa mốc tự do. Sau đó nhật ký chỉ được ghi thêm: sửa sai bằng
 *   mốc đính chính nêu rõ mốc bị thay, mốc gốc vẫn hiện bên cạnh.
 * - Khóa tài khoản đại diện đóng băng nhật ký (không thêm mốc, không đính chính).
 */
export const JOURNAL_STAGES = ['clay', 'throw', 'dry', 'paint', 'glaze', 'fire', 'finish'] as const;
export type JournalStage = (typeof JOURNAL_STAGES)[number];

export function isJournalStage(value: unknown): value is JournalStage {
  return typeof value === 'string' && (JOURNAL_STAGES as readonly string[]).includes(value);
}

export type JournalRuleCode =
  | 'JOURNAL_FROZEN'
  | 'JOURNAL_SKIP_REASON_REQUIRED'
  | 'JOURNAL_CORRECTION_TARGET_NOT_FOUND'
  | 'JOURNAL_CORRECTION_TARGET_SUPERSEDED'
  | 'JOURNAL_CORRECTION_BEFORE_PUBLICATION'
  | 'JOURNAL_PUBLISHED_IMMUTABLE';

/** Thông tin tối thiểu về một mốc đã có, theo thứ tự `seq`. */
export interface JournalEntryFacts {
  readonly seq: number;
  readonly stage: JournalStage;
  readonly supersedesSeq?: number | null | undefined;
}

export interface JournalState {
  readonly entries: readonly JournalEntryFacts[];
  /** Sản phẩm đã từng được xuất bản ⇒ nhật ký chỉ còn ghi thêm. */
  readonly published: boolean;
  /** Tài khoản đại diện bị khóa. */
  readonly frozen: boolean;
}

export interface NewEntryInput {
  readonly stage: JournalStage;
  readonly skipReason?: string | undefined;
  readonly supersedesSeq?: number | undefined;
}

/**
 * Công đoạn mà mốc mới "nhảy qua": nằm sau công đoạn xa nhất đã ghi và trước `stage`, chưa mốc nào ghi.
 * Công đoạn bị bỏ trước đó đã được giải trình ở mốc từng nhảy qua nó nên không bị đòi lý do lần nữa;
 * lặp lại hay quay về công đoạn cũ cũng không phát sinh bỏ qua.
 */
export function skippedStagesFor(
  entries: readonly JournalEntryFacts[],
  stage: JournalStage,
): JournalStage[] {
  const furthest = Math.max(-1, ...entries.map((e) => JOURNAL_STAGES.indexOf(e.stage)));
  return JOURNAL_STAGES.slice(furthest + 1, JOURNAL_STAGES.indexOf(stage));
}

/** Công đoạn chưa ghi lần nào — trang QR nêu tên khi nhật ký còn dang dở. */
export function missingStages(entries: readonly JournalEntryFacts[]): JournalStage[] {
  const recorded = new Set(entries.map((e) => e.stage));
  return JOURNAL_STAGES.filter((s) => !recorded.has(s));
}

/** Nhật ký dang dở: chưa có mốc `finish`. */
export function isJournalInProgress(entries: readonly JournalEntryFacts[]): boolean {
  return !entries.some((e) => e.stage === 'finish');
}

/** `seq` các mốc đã bị một mốc khác đính chính. */
export function supersededSeqs(entries: readonly JournalEntryFacts[]): Set<number> {
  return new Set(
    entries.flatMap((e) =>
      e.supersedesSeq === null || e.supersedesSeq === undefined ? [] : [e.supersedesSeq],
    ),
  );
}

/** Kiểm một mốc mới (ghi thêm hoặc đính chính) trước khi niêm phong vào chuỗi. */
export function checkNewEntry(
  state: JournalState,
  input: NewEntryInput,
): Result<void, DomainError<JournalRuleCode>> {
  if (state.frozen) {
    return err(new DomainError('JOURNAL_FROZEN', 'representative account is locked'));
  }
  if (input.supersedesSeq !== undefined) {
    if (!state.published) {
      return err(
        new DomainError(
          'JOURNAL_CORRECTION_BEFORE_PUBLICATION',
          'edit the entry directly until the product is first published',
        ),
      );
    }
    if (!state.entries.some((e) => e.seq === input.supersedesSeq)) {
      return err(
        new DomainError('JOURNAL_CORRECTION_TARGET_NOT_FOUND', 'superseded entry does not exist', {
          supersedesSeq: input.supersedesSeq,
        }),
      );
    }
    if (supersededSeqs(state.entries).has(input.supersedesSeq)) {
      return err(
        new DomainError(
          'JOURNAL_CORRECTION_TARGET_SUPERSEDED',
          'entry already corrected; correct the latest correction instead',
          { supersedesSeq: input.supersedesSeq },
        ),
      );
    }
    return ok(undefined);
  }
  const skipped = skippedStagesFor(state.entries, input.stage);
  if (skipped.length > 0 && !input.skipReason?.trim()) {
    return err(
      new DomainError('JOURNAL_SKIP_REASON_REQUIRED', 'skipping stages requires a reason', {
        skipped,
      }),
    );
  }
  return ok(undefined);
}

/** Sửa / xóa trực tiếp chỉ được phép trước lần xuất bản đầu tiên. */
export function checkDraftEdit(state: JournalState): Result<void, DomainError<JournalRuleCode>> {
  if (state.frozen) {
    return err(new DomainError('JOURNAL_FROZEN', 'representative account is locked'));
  }
  if (state.published) {
    return err(
      new DomainError(
        'JOURNAL_PUBLISHED_IMMUTABLE',
        'published entries are only changed by a correction entry',
      ),
    );
  }
  return ok(undefined);
}

/**
 * Mẫu công đoạn theo danh mục (FR-PRD-03). Làng hiện chỉ có gốm nên mọi danh mục dùng cùng một mẫu;
 * nghề khác sẽ có mẫu riêng tại đây.
 */
export function stageTemplateForCategory(_category: string): readonly JournalStage[] {
  return JOURNAL_STAGES;
}
