import { PublicShell } from '@/components/shell/public-shell';
import { requireArea } from '@/lib/auth/guard';
import { resolveLocale } from '@/lib/locale';

// Layout và page render song song nên layout tự khóa locale để trang vẫn dựng tĩnh được.
// Khu Buyer cần đăng nhập với vai trò Buyer: khách bị chuyển tới đăng nhập, vai trò khác nhận 403.
export default async function Layout({ children, params }: LayoutProps<'/[locale]'>) {
  const locale = await resolveLocale(params);
  await requireArea('buyer', locale);
  return <PublicShell>{children}</PublicShell>;
}
