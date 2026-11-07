import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { Link } from '@/i18n/navigation';
import { resolveLocale } from '@/lib/locale';
import { privacyContactEmail } from '@/lib/site';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/chinh-sach-quyen-rieng-tu'>): Promise<Metadata> {
  await resolveLocale(params);
  const t = await getTranslations('privacy');
  return { title: t('title'), description: t('lead') };
}

/** Section ids in reading order; each has `privacy.sections.<id>.title`. */
const SECTION_IDS = [
  'controller',
  'collect',
  'purpose',
  'basis',
  'sharing',
  'retention',
  'security',
  'cookies',
  'rights',
  'changes',
] as const;

const COLLECT_ITEMS = ['account', 'household', 'quote', 'usage', 'technical'] as const;
const SHARING_ITEMS = ['documents', 'quote', 'hosting', 'public'] as const;

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="flex scroll-mt-24 flex-col gap-3">
      <h2 id={`${id}-title`} className="text-h3">
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * Privacy policy (NFR-SEC-07): what is collected, why, who sees it, how long it is kept and the
 * data subject's rights (download and deletion are self-service on the account page). Static copy from the `privacy` messages in both languages; the contact
 * email shows only when `NEXT_PUBLIC_PRIVACY_EMAIL` is set.
 */
export default async function PrivacyPolicyPage({
  params,
}: PageProps<'/[locale]/chinh-sach-quyen-rieng-tu'>) {
  await resolveLocale(params);
  const [t, common] = await Promise.all([getTranslations('privacy'), getTranslations('common')]);
  const email = privacyContactEmail();

  return (
    <article className="mx-auto flex max-w-prose-vn flex-col gap-8 px-gutter pt-10 pb-section">
      <Breadcrumbs items={[{ label: common('home'), href: '/' }, { label: t('title') }]} />
      <header className="flex flex-col gap-3">
        <h1 className="text-h1">{t('title')}</h1>
        <p className="text-ash">{t('lead')}</p>
        <p className="text-small text-ash">{t('updated')}</p>
      </header>

      <nav aria-label={t('toc')} className="rounded-card bg-surface p-5 ring-1 ring-ink/5">
        <p className="mb-2 font-medium">{t('toc')}</p>
        <ol className="list-decimal space-y-1 pl-5 text-small">
          {SECTION_IDS.map((id) => (
            <li key={id}>
              <a href={`#${id}`} className="text-clay underline underline-offset-4">
                {t(`sections.${id}.title`)}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <Section id="controller" title={t('sections.controller.title')}>
        <p>{t('sections.controller.text')}</p>
      </Section>
      <Section id="collect" title={t('sections.collect.title')}>
        <p>{t('sections.collect.text')}</p>
        <ul className="list-disc space-y-2 pl-6">
          {COLLECT_ITEMS.map((item) => (
            <li key={item}>{t(`sections.collect.items.${item}`)}</li>
          ))}
        </ul>
      </Section>
      <Section id="purpose" title={t('sections.purpose.title')}>
        <p>{t('sections.purpose.text')}</p>
      </Section>
      <Section id="basis" title={t('sections.basis.title')}>
        <p>{t('sections.basis.text')}</p>
      </Section>
      <Section id="sharing" title={t('sections.sharing.title')}>
        <ul className="list-disc space-y-2 pl-6">
          {SHARING_ITEMS.map((item) => (
            <li key={item}>{t(`sections.sharing.items.${item}`)}</li>
          ))}
        </ul>
      </Section>
      <Section id="retention" title={t('sections.retention.title')}>
        <p>{t('sections.retention.text')}</p>
      </Section>
      <Section id="security" title={t('sections.security.title')}>
        <p>{t('sections.security.text')}</p>
      </Section>
      <Section id="cookies" title={t('sections.cookies.title')}>
        <p>{t('sections.cookies.text')}</p>
      </Section>
      <Section id="rights" title={t('sections.rights.title')}>
        <p>
          {t.rich('sections.rights.text', {
            account: (chunks) => (
              <Link href="/tai-khoan" className="text-clay underline underline-offset-4">
                {chunks}
              </Link>
            ),
            contact: (chunks) =>
              email ? (
                <a href={`mailto:${email}`} className="text-clay underline underline-offset-4">
                  {email}
                </a>
              ) : (
                chunks
              ),
          })}
        </p>
      </Section>
      <Section id="changes" title={t('sections.changes.title')}>
        <p>{t('sections.changes.text')}</p>
      </Section>
    </article>
  );
}
