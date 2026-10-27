import { PublicShell } from '@/components/shell/public-shell';
import { resolveLocale } from '@/lib/locale';

// Layout và page render song song nên layout tự khóa locale để trang vẫn dựng tĩnh được.
export default async function Layout({ children, params }: LayoutProps<'/[locale]'>) {
  await resolveLocale(params);
  return <PublicShell>{children}</PublicShell>;
}
