import { PublicShell } from '@/components/shell/public-shell';
import { requireArea } from '@/lib/auth/guard';
import { resolveLocale } from '@/lib/locale';

// Studio của hộ: chỉ người đại diện hộ. Hộ chưa được chấp nhận (chờ duyệt, bị từ chối) chỉ xem được
// trang trạng thái hồ sơ `/studio/ho-so`; mọi trang Studio khác chuyển về đó.
export default async function StudioLayout({ children, params }: LayoutProps<'/[locale]/studio'>) {
  const locale = await resolveLocale(params);
  await requireArea('studio', locale);
  return <PublicShell>{children}</PublicShell>;
}
