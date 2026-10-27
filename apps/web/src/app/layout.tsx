import type { Metadata } from 'next';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: 'vCraft — Tinh hoa làng nghề, muôn phương lan tỏa',
  description:
    'Triển lãm số, truy xuất nguồn gốc và điều phối đơn hàng cho làng nghề truyền thống.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
