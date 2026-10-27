import { Logo } from '@vcraft/ui';

// TODO(i18n): chuỗi tạm, chuyển sang @vcraft/i18n khi next-intl được nối (FR i18n).
export default function HomePage() {
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="flex flex-col items-center gap-6">
        <Logo size={72} />
        <p className="font-display type-soft text-h3 text-glaze">
          Tinh hoa làng nghề, muôn phương lan tỏa
        </p>
        <p className="max-w-prose text-small text-ash">
          Triển lãm số, truy xuất nguồn gốc và điều phối đơn hàng cho làng nghề truyền thống.
        </p>
      </div>
    </main>
  );
}
