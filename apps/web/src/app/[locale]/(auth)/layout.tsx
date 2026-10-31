import { PublicShell } from '@/components/shell/public-shell';
import { resolveLocale } from '@/lib/locale';

// Trang tài khoản dùng khung công khai (header có menu tài khoản). Layout tự khóa locale như các nhóm khác.
export default async function Layout({ children, params }: LayoutProps<'/[locale]'>) {
  await resolveLocale(params);
  return <PublicShell>{children}</PublicShell>;
}
