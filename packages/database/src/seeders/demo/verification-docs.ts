/**
 * Giấy tờ xác minh MẪU của hộ chờ duyệt (Gốm Bảo Châu): ảnh vẽ cục bộ bằng `scripts/demo-photos/make-specimen-docs.mjs`,
 * đóng dấu chéo "MẪU – KHÔNG CÓ GIÁ TRỊ", toàn số liệu giả. KHÔNG BAO GIỜ dùng giấy tờ thật của người thật làm dữ liệu mẫu.
 * Tệp nằm ở `scripts/demo-photos/specimen-docs/<id>.png` và được tải lên bucket riêng tư bằng `pnpm demo:media`.
 */
export interface DemoVerificationDoc {
  id: string;
  /** Tên loại giấy tờ hiển thị cho Ban quản lý trong màn duyệt hộ (FR-ADM-02). */
  caption: string;
  altText: string;
  /** English description of the same file. */
  altTextEn: string;
}

export const DEMO_VERIFICATION_DOCS: readonly DemoVerificationDoc[] = [
  {
    id: 'cccd-mau',
    caption: 'Căn cước công dân (bản mẫu)',
    altText: 'Bản mẫu căn cước công dân với số giả, đóng dấu chéo "MẪU – KHÔNG CÓ GIÁ TRỊ"',
    altTextEn:
      'Specimen citizen ID card with a fake number, stamped diagonally "MẪU – KHÔNG CÓ GIÁ TRỊ" (specimen, not valid)',
  },
  {
    id: 'cu-tru-mau',
    caption: 'Xác nhận cư trú (bản mẫu)',
    altText:
      'Bản mẫu giấy xác nhận cư trú với nội dung giả, đóng dấu chéo "MẪU – KHÔNG CÓ GIÁ TRỊ"',
    altTextEn:
      'Specimen residence certificate with fake content, stamped diagonally "MẪU – KHÔNG CÓ GIÁ TRỊ" (specimen, not valid)',
  },
  {
    id: 'xuong-mau',
    caption: 'Ảnh xưởng (bản mẫu)',
    altText: 'Hình vẽ minh họa ảnh xưởng gốm, đóng dấu chéo "MẪU – KHÔNG CÓ GIÁ TRỊ"',
    altTextEn:
      'Drawing standing in for a photo of the pottery workshop, stamped diagonally "MẪU – KHÔNG CÓ GIÁ TRỊ" (specimen, not valid)',
  },
];
