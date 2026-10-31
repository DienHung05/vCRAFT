import { redirect } from '@/i18n/navigation';
import { demoParams } from '@/lib/demo/data';
import { resolveLocale } from '@/lib/locale';

/** `/admin` chưa có tổng quan riêng: vào thẳng màn điều phối đầu tiên (đích sau đăng nhập của Admin). */
export default async function AdminIndexPage({ params }: PageProps<'/[locale]/admin'>) {
  const locale = await resolveLocale(params);
  const first = demoParams.coordinations[0];
  return first
    ? redirect({ href: { pathname: '/admin/dieu-phoi/[code]', params: { code: first } }, locale })
    : redirect({ href: '/', locale });
}
