import { FullMessagesProvider } from '@/components/full-messages-provider';
import { SessionUnavailable } from '@/components/session-unavailable';
import { PublicShell } from '@/components/shell/public-shell';
import { OutageBanner } from '@/features/studio/outage-banner';
import { StudioNav } from '@/features/studio/studio-nav';
import { requireArea } from '@/lib/auth/guard';
import { resolveLocale } from '@/lib/locale';

// Studio của hộ: chỉ người đại diện hộ. Hộ chưa được chấp nhận (chờ duyệt, bị từ chối, bị tạm ngừng) chỉ vào được
// trang trạng thái hồ sơ `/studio/ho-so`; mọi trang Studio khác chuyển về đó.
export async function StudioFrame({ children, params }: LayoutProps<'/[locale]/studio'>) {
  const locale = await resolveLocale(params);
  const viewer = await requireArea('studio', locale);
  // The API could not confirm the session: stay inside the shell with a retry instead of a 500 page.
  if (!viewer) {
    return (
      <PublicShell>
        <SessionUnavailable />
      </PublicShell>
    );
  }
  return (
    // The phone tab bar is fixed to the bottom edge; this keeps the footer clear of it.
    <div className="pb-16 md:pb-0">
      <PublicShell>
        <StudioNav />
        {viewer.household?.status === 'APPROVED' ? <OutageBanner /> : null}
        {children}
      </PublicShell>
    </div>
  );
}

export default function StudioLayout(props: LayoutProps<'/[locale]/studio'>) {
  return (
    <FullMessagesProvider>
      <StudioFrame {...props} />
    </FullMessagesProvider>
  );
}
