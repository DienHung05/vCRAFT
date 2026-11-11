'use client';

import type { RfqStatus } from '@vcraft/domain';
import { Stepper } from '@vcraft/ui';
import { useTranslations } from 'next-intl';
import { rfqStepperModel } from './rfq-flow';

export function RfqStepper({ status, hasBids = false }: { status: RfqStatus; hasBids?: boolean }) {
  const t = useTranslations('rfq');
  const model = rfqStepperModel(status, hasBids);
  const steps = model.steps.map((step) => ({ id: step, label: t(`status.${step}`) }));
  return (
    <Stepper
      label={t('stepperLabel')}
      current={model.current}
      state={model.halted ? 'halted' : 'active'}
      steps={steps}
      compactLabel={t('stepperCompact', {
        current: model.current + 1,
        total: steps.length,
        label: steps[model.current]?.label ?? '',
      })}
    />
  );
}
