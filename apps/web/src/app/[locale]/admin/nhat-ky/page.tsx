import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AuditLogView } from '@/features/admin/audit-log';
import { resolveLocale } from '@/lib/locale';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/admin/nhat-ky'>): Promise<Metadata> {
  await resolveLocale(params);
  const t = await getTranslations('admin.audit');
  return { title: t('title'), robots: { index: false } };
}

export default async function AuditLogPage({ params }: PageProps<'/[locale]/admin/nhat-ky'>) {
  await resolveLocale(params);
  return <AuditLogView />;
}
