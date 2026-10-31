import { PublicShell } from '@/components/shell/public-shell';
import { StudioNav } from '@/features/studio/studio-nav';
import { requireArea } from '@/lib/auth/guard';
import { resolveLocale } from '@/lib/locale';

// Studio của hộ: chỉ người đại diện hộ. Hộ chưa được chấp nhận (chờ duyệt, bị từ chối, bị tạm ngừng) chỉ vào được
// trang trạng thái hồ sơ `/studio/ho-so`; mọi trang Studio khác chuyển về đó.
export default async function StudioLayout({ children, params }: LayoutProps<'/[locale]/studio'>) {
  const locale = await resolveLocale(params);
  await requireArea('studio', locale);
  return (
    <PublicShell>
      <StudioNav />
      {children}
    </PublicShell>
  );
}
