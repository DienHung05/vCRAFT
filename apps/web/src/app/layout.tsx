import type { Metadata } from 'next';
import { Be_Vietnam_Pro, Fraunces, JetBrains_Mono } from 'next/font/google';
import '../styles/globals.css';

// Tự host qua next/font (BRAND §4), subset vietnamese + latin. Tên biến CSS khớp
// `--font-display/sans/mono` trong packages/ui/src/tokens/theme.css.
const fraunces = Fraunces({
  subsets: ['vietnamese', 'latin'],
  axes: ['opsz', 'SOFT', 'WONK'],
  variable: '--font-fraunces',
  display: 'swap',
});

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ['vietnamese', 'latin'],
  weight: ['400', '500', '600'],
  variable: '--font-be-vietnam',
  display: 'swap',
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ['vietnamese', 'latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'vCraft — Tinh hoa làng nghề, muôn phương lan tỏa',
  description:
    'Triển lãm số, truy xuất nguồn gốc và điều phối đơn hàng cho làng nghề truyền thống.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="vi"
      className={`${fraunces.variable} ${beVietnamPro.variable} ${jetBrainsMono.variable}`}
    >
      <body className="grain-fixed">{children}</body>
    </html>
  );
}
