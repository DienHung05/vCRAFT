import { PublicShell } from '@/components/shell/public-shell';
import { KilnStage } from '@/features/auth/kiln/kiln-stage';
import { resolveLocale } from '@/lib/locale';

// Trang tài khoản dùng khung công khai (header có menu tài khoản). Layout tự khóa locale như các nhóm khác.
// The kiln scene is rendered here, once, so it persists across soft navigations between the account pages
// and while `loading.tsx` swaps for the page; each page brings only its seal column and card (AuthShell).
export default async function Layout({ children, params }: LayoutProps<'/[locale]'>) {
  await resolveLocale(params);
  return (
    <PublicShell>
      <KilnStage>{children}</KilnStage>
    </PublicShell>
  );
}
