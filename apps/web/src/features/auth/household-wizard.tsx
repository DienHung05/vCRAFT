'use client';

import { Stepper } from '@vcraft/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { HOUSEHOLD_INTENT_KEY, hasHouseholdIntent } from '@/lib/auth/household-intent';
import { browserSupabase } from '@/lib/auth/supabase-browser';
import { DocumentUpload } from './document-upload';
import { RegisterForm } from './register-form';
import { WizardHouseholdStep } from './wizard-household-step';
import { WIZARD_STEPS, type WizardStep } from './wizard-steps';
import { WizardWorkshopStep } from './wizard-workshop-step';

/**
 * Wizard đăng ký hộ (FR-AUTH-02): Tài khoản → Thông tin hộ → Vị trí xưởng → Giấy tờ xác minh.
 * `initialStep` do server suy từ CSDL (xem `resolveWizardStart`), nên mở lại giữa chừng thì nối đúng
 * bước dang dở. Hồ sơ là `DRAFT` từ khi nộp thông tin hộ và chỉ vào `PENDING_REVIEW` khi nộp ở bước cuối.
 */
export function HouseholdWizard({
  initialStep,
  wizardPath,
}: {
  initialStep: WizardStep;
  /** Đường dẫn công khai của chính wizard, để thư xác minh và đăng nhập quay lại đây. */
  wizardPath: string;
}) {
  const t = useTranslations('auth.wizard');
  const [step, setStep] = useState<WizardStep>(initialStep);
  const heading = useRef<HTMLHeadingElement>(null);
  const focusNext = useRef(false);

  // Sang bước mới thì đưa tiêu đề bước vào tiêu điểm để trình đọc màn hình đọc đúng nội dung mới
  // (không làm khi mới mở trang, để khỏi giật cuộn).
  useEffect(() => {
    if (!focusNext.current) return;
    focusNext.current = false;
    heading.current?.focus();
  });

  // GH#180: a signed-in Buyer who reached the household step (signed in from the wizard, Google, or
  // came back later) is marked as registering a household, so the next sign-in resumes the wizard.
  useEffect(() => {
    if (initialStep !== 'household') return;
    const supabase = browserSupabase();
    if (!supabase) return;
    let active = true;
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!active || !data.user || hasHouseholdIntent(data.user.user_metadata)) return;
        return supabase.auth.updateUser({ data: { [HOUSEHOLD_INTENT_KEY]: true } });
      })
      .catch(() => {
        // Best effort: the wizard works without the flag.
      });
    return () => {
      active = false;
    };
  }, [initialStep]);

  const next = (to: WizardStep) => () => {
    focusNext.current = true;
    setStep(to);
  };

  return (
    <div className="flex flex-col gap-8">
      <Stepper
        label={t('stepsLabel')}
        current={WIZARD_STEPS.indexOf(step)}
        steps={WIZARD_STEPS.map((id) => ({ id, label: t(`steps.${id}`) }))}
      />
      <section aria-labelledby="wizard-step-title" className="flex flex-col gap-5">
        <header className="flex flex-col gap-1">
          <h2
            id="wizard-step-title"
            ref={heading}
            tabIndex={-1}
            className="font-display text-h3 text-glaze outline-none"
          >
            {t(`${step}.title`)}
          </h2>
          <p className="text-ash">{t(`${step}.lead`)}</p>
        </header>
        {step === 'account' ? <RegisterForm intent="household" wizardPath={wizardPath} /> : null}
        {step === 'household' ? <WizardHouseholdStep onDone={next('workshop')} /> : null}
        {step === 'workshop' ? <WizardWorkshopStep onDone={next('documents')} /> : null}
        {step === 'documents' ? <DocumentUpload /> : null}
      </section>
    </div>
  );
}
