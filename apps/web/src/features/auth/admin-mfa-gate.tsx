'use client';

import { Button } from '@vcraft/ui';
import { useTranslations } from 'next-intl';
import { type FormEvent, useEffect, useState } from 'react';
import { browserSupabase } from '@/lib/auth/supabase-browser';
import { FormAlert, TextField } from './fields';

type Step =
  | { kind: 'loading' }
  | { kind: 'enroll'; factorId: string; qr: string; secret: string }
  | { kind: 'verify'; factorId: string }
  | { kind: 'failed' };

const CODE = /^\d{6}$/;

/**
 * Second factor for the admin area (GH#83, ARCHITECTURE §7.5): an admin whose session is still `aal1`
 * sees this instead of the admin pages. With no TOTP factor yet it shows the QR code to scan; otherwise
 * it asks for the 6-digit code. Supabase verifies the code and upgrades the session to `aal2`, then the
 * page reloads so the server guard and the API see the new session.
 */
export function AdminMfaGate() {
  const t = useTranslations('auth.mfa');
  const [step, setStep] = useState<Step>({ kind: 'loading' });
  const [code, setCode] = useState('');
  const [error, setError] = useState<'invalid' | 'failed' | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = browserSupabase();
    if (!supabase) return setStep({ kind: 'failed' });
    let live = true;
    void (async () => {
      const listed = await supabase.auth.mfa.listFactors();
      if (listed.error) return live && setStep({ kind: 'failed' });
      const verified = listed.data.totp[0];
      if (verified) return live && setStep({ kind: 'verify', factorId: verified.id });
      // A factor enrolled earlier but never confirmed would block a new one with the same name.
      for (const stale of listed.data.all.filter(
        (f) => f.factor_type === 'totp' && f.status !== 'verified',
      ))
        await supabase.auth.mfa.unenroll({ factorId: stale.id });
      const enrolled = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `vCraft admin ${new Date().toISOString().slice(0, 10)}`,
      });
      if (enrolled.error) return live && setStep({ kind: 'failed' });
      if (live)
        setStep({
          kind: 'enroll',
          factorId: enrolled.data.id,
          qr: enrolled.data.totp.qr_code,
          secret: enrolled.data.totp.secret,
        });
    })();
    return () => {
      live = false;
    };
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (step.kind !== 'enroll' && step.kind !== 'verify') return;
    const value = code.replace(/\s/g, '');
    if (!CODE.test(value)) return setError('invalid');
    const supabase = browserSupabase();
    if (!supabase) return setError('failed');
    setBusy(true);
    setError(null);
    const result = await supabase.auth.mfa.challengeAndVerify({
      factorId: step.factorId,
      code: value,
    });
    if (result.error) {
      setBusy(false);
      setCode('');
      return setError('invalid');
    }
    window.location.reload();
  };

  return (
    <section className="mx-auto flex max-w-md flex-col gap-5 py-10" aria-labelledby="mfa-title">
      <header className="flex flex-col gap-2">
        <h1 id="mfa-title" className="font-display text-h2 text-glaze">
          {step.kind === 'enroll' ? t('enrollTitle') : t('verifyTitle')}
        </h1>
        <p className="text-ash">{step.kind === 'enroll' ? t('enrollLead') : t('verifyLead')}</p>
      </header>
      {step.kind === 'loading' ? (
        <p role="status" className="text-ash">
          {t('loading')}
        </p>
      ) : null}
      {step.kind === 'failed' ? <FormAlert tone="error">{t('failed')}</FormAlert> : null}
      {step.kind === 'enroll' ? (
        <div className="flex flex-col items-start gap-3">
          {/* Supabase returns the QR as an SVG data URI built from the factor's secret. */}
          {/* biome-ignore lint/performance/noImgElement: a data URI, nothing for next/image to optimise. */}
          <img
            src={step.qr}
            alt={t('qrAlt')}
            width={180}
            height={180}
            className="rounded-card bg-white p-2"
          />
          <p className="text-small text-ash">
            {t('secretLabel')} <code className="break-all font-mono text-ink">{step.secret}</code>
          </p>
        </div>
      ) : null}
      {step.kind === 'enroll' || step.kind === 'verify' ? (
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          {error ? <FormAlert tone="error">{t(error)}</FormAlert> : null}
          <TextField
            label={t('codeLabel')}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
          <Button type="submit" size="lg" disabled={busy}>
            {busy ? t('verifying') : t('submit')}
          </Button>
        </form>
      ) : null}
    </section>
  );
}
