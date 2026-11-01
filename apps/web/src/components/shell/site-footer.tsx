import { Logo, WaveDivider } from '@vcraft/ui';
import { Clock, Mail, MapPin, Phone } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { SUPPORT_HOURS, siteContact } from '@/lib/contact';
import { LocaleSwitcher } from './locale-switcher';

const LINK_CLASS =
  'inline-block py-1.5 text-small text-ink/80 underline-offset-4 transition-colors hover:text-clay hover:underline';

const EXPLORE = [
  { href: '/san-pham', key: 'products' },
  { href: '/nghe-nhan', key: 'artisans' },
  { href: '/ban-do', key: 'map' },
  { href: '/tin-tuc', key: 'news' },
] as const;

/** Public site footer: brand and about, link columns, contact block and the legal strip. Server-rendered. */
export async function SiteFooter() {
  const [t, nav] = await Promise.all([getTranslations('footer'), getTranslations('nav')]);
  const contact = siteContact();
  const facebookLabel = displayUrl(contact.facebook);

  return (
    <footer className="mt-section">
      <WaveDivider />
      <div className="mx-auto grid max-w-editorial gap-x-12 gap-y-12 px-gutter pt-14 pb-12 md:grid-cols-2 xl:grid-cols-12">
        <div className="flex flex-col gap-5 md:col-span-2 xl:col-span-4">
          <Link href="/" aria-label={nav('home')} className="w-fit">
            <Logo size={36} />
          </Link>
          <p className="max-w-sm font-display text-h3 text-glaze type-soft">{t('tagline')}</p>
          <p className="max-w-md text-small text-ash">{t('about')}</p>
        </div>

        <nav
          aria-label={t('label')}
          className="grid grid-cols-2 gap-x-6 gap-y-10 md:col-span-1 xl:col-span-4"
        >
          <div>
            <FooterHeading>{t('explore')}</FooterHeading>
            <ul>
              {EXPLORE.map((item) => (
                <li key={item.key}>
                  <Link href={item.href} className={LINK_CLASS}>
                    {nav(item.key)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <FooterHeading>{t('business')}</FooterHeading>
            <ul>
              <li>
                <Link href="/yeu-cau-bao-gia" className={LINK_CLASS}>
                  {nav('quotes')}
                </Link>
              </li>
              <li>
                <Link href="/yeu-cau-bao-gia/moi" className={LINK_CLASS}>
                  {t('newQuote')}
                </Link>
              </li>
              <li>
                <Link href="/dang-ky-nghe-nhan" className={LINK_CLASS}>
                  {t('registerHousehold')}
                </Link>
              </li>
            </ul>
          </div>
        </nav>

        <section
          aria-labelledby="footer-contact"
          className="rounded-card bg-surface p-6 ring-1 ring-ink/8 md:col-span-1 xl:col-span-4"
        >
          <FooterHeading id="footer-contact">{t('contact')}</FooterHeading>
          <address className="not-italic">
            <dl className="space-y-4">
              <ContactRow icon={<Phone />} label={t('phone')}>
                <a
                  href={contact.phone.href}
                  className="font-display text-[1.375rem] leading-tight font-semibold tracking-tight text-glaze type-soft underline-offset-4 hover:underline"
                >
                  {contact.phone.display}
                </a>
              </ContactRow>
              <ContactRow icon={<Mail />} label={t('email')}>
                <a
                  href={`mailto:${contact.email}`}
                  className="break-all underline underline-offset-4 hover:text-clay"
                >
                  {contact.email}
                </a>
              </ContactRow>
              <ContactRow icon={<FacebookIcon />} label={t('facebook')}>
                <a
                  href={contact.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all underline underline-offset-4 hover:text-clay"
                >
                  {facebookLabel}
                  <span className="sr-only"> {t('newTab')}</span>
                </a>
              </ContactRow>
              <ContactRow icon={<MapPin />} label={t('address')}>
                {t('addressValue')}
              </ContactRow>
              <ContactRow icon={<Clock />} label={t('hours')}>
                {t('hoursValue', SUPPORT_HOURS)}
              </ContactRow>
            </dl>
          </address>
        </section>
      </div>

      <div className="border-ink/8 border-t">
        <div className="mx-auto flex max-w-editorial flex-col gap-4 px-gutter py-6 text-small text-ash lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <p>{t('rights', { year: new Date().getFullYear() })}</p>
            <p>{t('demo')}</p>
          </div>
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <li>
              <Link
                href="/chinh-sach-quyen-rieng-tu"
                className="inline-block py-1.5 underline underline-offset-2 hover:text-ink"
              >
                {t('privacy')}
              </Link>
            </li>
            <li>
              <Link
                href="/ghi-nhan-anh"
                className="inline-block py-1.5 underline underline-offset-2 hover:text-ink"
              >
                {t('credits')}
              </Link>
            </li>
            <li>
              <LocaleSwitcher />
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}

function FooterHeading({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h2
      id={id}
      className="mb-3 font-sans text-small font-semibold tracking-wide text-ash uppercase"
    >
      {children}
    </h2>
  );
}

/** One labelled line of the contact block: round icon chip, small label, then the value. */
function ContactRow({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[2.25rem_minmax(0,1fr)] items-start gap-x-3">
      <span
        aria-hidden="true"
        className="grid size-9 place-items-center rounded-chip bg-clay/10 text-clay-ink [&>svg]:size-[1.125rem]"
      >
        {icon}
      </span>
      <div>
        <dt className="text-[0.75rem] leading-tight font-medium tracking-wide text-ash uppercase">
          {label}
        </dt>
        <dd className="mt-1 text-small text-ink">{children}</dd>
      </div>
    </div>
  );
}

/** `https://www.facebook.com/vcraft.battrang/` becomes `facebook.com/vcraft.battrang`. */
function displayUrl(url: string): string {
  try {
    const { hostname, pathname } = new URL(url);
    return `${hostname.replace(/^www\./, '')}${pathname.replace(/\/+$/, '')}`;
  } catch {
    return url;
  }
}

/** lucide-react dropped its brand icons in v1, so the Facebook "f" is drawn here. */
function FacebookIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" focusable="false">
      <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H8v3h2.5V21h3Z" />
    </svg>
  );
}
