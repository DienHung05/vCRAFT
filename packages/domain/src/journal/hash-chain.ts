/**
 * Chuỗi băm nhật ký sản xuất (SRS BR-01, FR-PRD-05, FR-TRC-05).
 *
 *   hash_i = SHA-256(canonicalJSON{ productId, seq, stageCode, occurredAt, note, mediaChecksums[], prevHash,
 *                                   supersedesSeq?, skipReason? })
 *   hash_0.prevHash = "GENESIS"
 *
 * `occurredAt` là ngày hộ khai (không phải giờ lưu). `supersedesSeq` (mốc đính chính) và `skipReason`
 * (bỏ qua công đoạn) chỉ có mặt khi khác rỗng, nên chuỗi cũ không có hai trường này vẫn băm như trước.
 *
 * `canonicalJSON`: khóa đối tượng sắp tăng dần theo thứ tự code unit, không khoảng trắng, chuỗi thoát
 * theo `JSON.stringify`, mã hóa UTF-8. Mảng giữ nguyên thứ tự. `occurredAt` được băm đúng chuỗi đã lưu.
 *
 * Hàm thuần, chỉ cần `crypto.subtle` (Web Crypto) nên chạy cả trên trình duyệt lẫn Node/Edge.
 * Chuỗi toàn vẹn chỉ cho biết nhật ký không bị sửa sau khi ghi; nó không chứng minh điều ghi trong
 * nhật ký là thật ngoài đời.
 */

export const GENESIS = 'GENESIS';

/** Phần nội dung của một mốc nhật ký (đầu vào để băm), chưa có `prevHash`/`hash`. */
export interface ChainContent {
  stage: string;
  at: string;
  note: string;
  /** SHA-256 (hex) của từng ảnh minh chứng. */
  mediaChecksums: readonly string[];
  /** `seq` của mốc bị mốc này đính chính (GLOSSARY: Correction entry). */
  supersedesSeq?: number | undefined;
  /** Lý do bỏ qua công đoạn trước đó chưa từng ghi. */
  skipReason?: string | undefined;
}

/** Một mốc đã niêm phong: nội dung + vị trí + dấu băm. */
export interface ChainEntry extends ChainContent {
  seq: number;
  prevHash: string;
  hash: string;
}

export type ChainFailureReason = 'seq' | 'prev' | 'hash';

export type ChainVerification =
  | { ok: true; count: number }
  | { ok: false; index: number; reason: ChainFailureReason };

/** Chuỗi JSON chuẩn tắc (khóa sắp xếp, không khoảng trắng). */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v)).join(',')}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((k) => record[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(record[k])}`).join(',')}}`;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Phần Web Crypto (`crypto.subtle`) cần dùng. Khai báo cấu trúc tối giản để domain không phụ thuộc
 * lib DOM hay Node; `SubtleCrypto` của trình duyệt và của Node (≥ 19) đều thỏa.
 */
export interface SubtleCrypto {
  digest(algorithm: 'SHA-256', data: Uint8Array<ArrayBuffer>): Promise<ArrayBuffer>;
}

interface WebCryptoGlobals {
  crypto: { subtle: SubtleCrypto };
  TextEncoder: new () => { encode(text: string): Uint8Array<ArrayBuffer> };
}

const runtime = globalThis as unknown as WebCryptoGlobals;

/** SHA-256 của chuỗi UTF-8, trả về hex thường 64 ký tự. */
export async function sha256Hex(
  text: string,
  subtle: SubtleCrypto = runtime.crypto.subtle,
): Promise<string> {
  return toHex(await subtle.digest('SHA-256', new runtime.TextEncoder().encode(text)));
}

/** Dấu băm của mốc `seq` thuộc sản phẩm `productId`, nối với `prevHash`. */
export function computeEntryHash(
  productId: string,
  entry: Pick<ChainEntry, 'seq' | 'prevHash'> & ChainContent,
  subtle?: SubtleCrypto,
): Promise<string> {
  return sha256Hex(
    canonicalJson({
      productId,
      seq: entry.seq,
      stageCode: entry.stage,
      occurredAt: entry.at,
      note: entry.note,
      mediaChecksums: entry.mediaChecksums,
      prevHash: entry.prevHash,
      supersedesSeq: entry.supersedesSeq ?? undefined,
      skipReason: entry.skipReason || undefined,
    }),
    subtle,
  );
}

/** Niêm phong danh sách mốc theo thứ tự: gán `seq`, `prevHash`, `hash`. Dùng để sinh dữ liệu mẫu. */
export async function sealChain<T extends ChainContent>(
  productId: string,
  contents: readonly T[],
  subtle?: SubtleCrypto,
): Promise<(T & ChainEntry)[]> {
  const out: (T & ChainEntry)[] = [];
  let prevHash = GENESIS;
  for (const [seq, content] of contents.entries()) {
    const hash = await computeEntryHash(productId, { ...content, seq, prevHash }, subtle);
    out.push({ ...content, seq, prevHash, hash });
    prevHash = hash;
  }
  return out;
}

/**
 * Kiểm chuỗi từ mốc đầu tới cuối, dừng ở mốc đầu tiên sai. Với mỗi mốc kiểm lần lượt:
 * `seq` liên tục từ 0, `prevHash` khớp `hash` của mốc trước (mốc 0 là `GENESIS`), rồi tính lại `hash`
 * từ nội dung. Sửa nội dung một mốc ⇒ lỗi `hash` tại chính mốc đó; sửa luôn cả `hash` ⇒ mốc kế tiếp
 * lỗi `prev`.
 */
export async function verifyChain(
  productId: string,
  entries: readonly ChainEntry[],
  subtle?: SubtleCrypto,
): Promise<ChainVerification> {
  let prevHash = GENESIS;
  for (const [index, entry] of entries.entries()) {
    if (entry.seq !== index) return { ok: false, index, reason: 'seq' };
    if (entry.prevHash !== prevHash) return { ok: false, index, reason: 'prev' };
    const expected = await computeEntryHash(productId, entry, subtle);
    if (entry.hash !== expected) return { ok: false, index, reason: 'hash' };
    prevHash = entry.hash;
  }
  return { ok: true, count: entries.length };
}
