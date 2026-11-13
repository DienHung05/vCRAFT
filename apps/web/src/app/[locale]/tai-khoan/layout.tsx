import { FullMessagesProvider } from '@/components/full-messages-provider';
import { PublicShell } from '@/components/shell/public-shell';
import { resolveLocale } from '@/lib/locale';

// Trang tài khoản dùng khung công khai (header có chuông và menu tài khoản); việc chặn khách nằm ở page.
export default async function AccountLayout({
  children,
  params,
}: LayoutProps<'/[locale]/tai-khoan'>) {
  await resolveLocale(params);
  return (
    <FullMessagesProvider>
      <PublicShell>{children}</PublicShell>
    </FullMessagesProvider>
  );
}
