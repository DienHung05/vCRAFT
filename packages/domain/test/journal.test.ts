import { describe, expect, it } from 'vitest';
import {
  type ChainContent,
  checkDraftEdit,
  checkNewEntry,
  computeEntryHash,
  isJournalInProgress,
  type JournalEntryFacts,
  type JournalState,
  missingStages,
  sealChain,
  skippedStagesFor,
  supersededSeqs,
  verifyChain,
} from '../src';

const entries: JournalEntryFacts[] = [
  { seq: 0, stage: 'clay' },
  { seq: 1, stage: 'throw' },
  { seq: 2, stage: 'dry' },
];
const published: JournalState = { entries, published: true, frozen: false };

describe('công đoạn', () => {
  it('nhận ra công đoạn bị bỏ qua và công đoạn còn thiếu', () => {
    expect(skippedStagesFor(entries, 'glaze')).toEqual(['paint']);
    expect(skippedStagesFor(entries, 'throw')).toEqual([]);
    expect(skippedStagesFor([], 'throw')).toEqual(['clay']);
    // `paint` đã được giải trình khi nhảy tới `glaze`: ghi tiếp `glaze` hay `fire` không bị đòi lại
    const afterSkip = [...entries, { seq: 3, stage: 'glaze' as const }];
    expect(skippedStagesFor(afterSkip, 'glaze')).toEqual([]);
    expect(skippedStagesFor(afterSkip, 'fire')).toEqual([]);
    expect(skippedStagesFor(afterSkip, 'finish')).toEqual(['fire']);
    expect(missingStages(entries)).toEqual(['paint', 'glaze', 'fire', 'finish']);
    expect(isJournalInProgress(entries)).toBe(true);
    expect(isJournalInProgress([...entries, { seq: 3, stage: 'finish' }])).toBe(false);
  });

  it('bỏ qua công đoạn bắt buộc một dòng lý do; lặp lại công đoạn thì không', () => {
    const skip = checkNewEntry(published, { stage: 'glaze', skipReason: '  ' });
    expect(skip.ok).toBe(false);
    if (!skip.ok) expect(skip.error.code).toBe('JOURNAL_SKIP_REASON_REQUIRED');
    expect(checkNewEntry(published, { stage: 'glaze', skipReason: 'Men trắng, không vẽ' }).ok).toBe(
      true,
    );
    expect(checkNewEntry(published, { stage: 'dry' }).ok).toBe(true);
  });
});

describe('đính chính', () => {
  it('chỉ đính chính sau khi xuất bản, mốc đích phải tồn tại và chưa bị đính chính', () => {
    const draft = checkNewEntry(
      { ...published, published: false },
      { stage: 'dry', supersedesSeq: 2 },
    );
    expect(draft.ok ? undefined : draft.error.code).toBe('JOURNAL_CORRECTION_BEFORE_PUBLICATION');

    const missing = checkNewEntry(published, { stage: 'dry', supersedesSeq: 9 });
    expect(missing.ok ? undefined : missing.error.code).toBe('JOURNAL_CORRECTION_TARGET_NOT_FOUND');

    expect(checkNewEntry(published, { stage: 'dry', supersedesSeq: 2 }).ok).toBe(true);

    const corrected = [...entries, { seq: 3, stage: 'dry' as const, supersedesSeq: 2 }];
    expect(supersededSeqs(corrected)).toEqual(new Set([2]));
    const twice = checkNewEntry(
      { ...published, entries: corrected },
      { stage: 'dry', supersedesSeq: 2 },
    );
    expect(twice.ok ? undefined : twice.error.code).toBe('JOURNAL_CORRECTION_TARGET_SUPERSEDED');
    // đính chính tiếp bản đính chính mới nhất thì được
    expect(
      checkNewEntry({ ...published, entries: corrected }, { stage: 'dry', supersedesSeq: 3 }).ok,
    ).toBe(true);
  });

  it('sau khi xuất bản không sửa/xóa trực tiếp; khóa tài khoản đóng băng mọi thay đổi', () => {
    expect(checkDraftEdit({ ...published, published: false }).ok).toBe(true);
    const edit = checkDraftEdit(published);
    expect(edit.ok ? undefined : edit.error.code).toBe('JOURNAL_PUBLISHED_IMMUTABLE');
    const frozen = checkNewEntry({ ...published, frozen: true }, { stage: 'fire' });
    expect(frozen.ok ? undefined : frozen.error.code).toBe('JOURNAL_FROZEN');
    expect(checkDraftEdit({ ...published, published: false, frozen: true }).ok).toBe(false);
  });
});

describe('chuỗi băm có đính chính và lý do bỏ qua', () => {
  const contents: ChainContent[] = [
    { stage: 'clay', at: '2026-09-02', note: 'Nhào đất.', mediaChecksums: [] },
    {
      stage: 'glaze',
      at: '2026-09-20',
      note: 'Tráng men.',
      mediaChecksums: [],
      skipReason: 'Không vẽ',
    },
    { stage: 'glaze', at: '2026-09-21', note: 'Đúng ngày.', mediaChecksums: [], supersedesSeq: 1 },
  ];

  it('mốc không có trường tùy chọn băm y như định dạng cũ', async () => {
    const withUndefined = await computeEntryHash('p', {
      ...contents[0]!,
      seq: 0,
      prevHash: 'GENESIS',
      supersedesSeq: undefined,
      skipReason: '',
    });
    const plain = await computeEntryHash('p', { ...contents[0]!, seq: 0, prevHash: 'GENESIS' });
    expect(withUndefined).toBe(plain);
  });

  it('sửa trường đính chính hoặc lý do bỏ qua làm gãy chuỗi đúng tại mốc đó', async () => {
    const sealed = await sealChain('p', contents);
    expect(await verifyChain('p', sealed)).toEqual({ ok: true, count: 3 });

    const retargeted = sealed.map((e, i) => (i === 2 ? { ...e, supersedesSeq: 0 } : e));
    expect(await verifyChain('p', retargeted)).toEqual({ ok: false, index: 2, reason: 'hash' });

    const reasonEdited = sealed.map((e, i) => (i === 1 ? { ...e, skipReason: 'khác' } : e));
    expect(await verifyChain('p', reasonEdited)).toEqual({ ok: false, index: 1, reason: 'hash' });
  });
});
