'use client';

import { ApiError, type StudioClient } from '@vcraft/api-client';
import type { HouseholdDto, UpdateHouseholdProfileRequest } from '@vcraft/contracts';
import { type CraftCategory, isValidIdNumber } from '@vcraft/domain';
import { Button, Card } from '@vcraft/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { DocumentUpload } from '@/features/auth/document-upload';
import { CraftFields } from '@/features/studio/craft-fields';
import { HouseholdGate } from '@/features/studio/household-gate';
import { StoryEditor } from '@/features/studio/story-editor';
import { inputClass, WorkshopEditor } from '@/features/studio/workshop-editor';

import { notify } from '@/lib/notify';

type SaveState = 'idle' | 'saving' | 'stale' | 'failed';

/**
 * The basic application sections a pending household may edit (FR-AUTH-02, vCRAFT-8my.2): the story
 * and the citizen ID number, plus more private evidence. Approved-only blocks (timeline, gallery,
 * products) stay out: their APIs gate on the household being approved.
 */
export function PendingApplicationEditor({ client }: { client?: StudioClient }) {
  return (
    <HouseholdGate client={client}>
      {(view) =>
        view.household.status === 'PENDING_REVIEW' ? (
          <ApplicationFields
            household={view.household}
            client={view.client}
            onSaved={view.reload}
          />
        ) : null
      }
    </HouseholdGate>
  );
}

function ApplicationFields({
  household,
  client,
  onSaved,
}: {
  household: HouseholdDto;
  client: StudioClient;
  onSaved: () => Promise<void>;
}) {
  const t = useTranslations('studio.profile');
  const profile = useTranslations('auth.profile');
  const [history, setHistory] = useState(household.history);
  const [craft, setCraft] = useState(household.craft ?? '');
  const [craftCategory, setCraftCategory] = useState<CraftCategory | ''>(
    household.craftCategory ?? '',
  );
  const [village, setVillage] = useState(household.village ?? '');
  const [foundedYear, setFoundedYear] = useState(household.foundedYear?.toString() ?? '');
  const [idNumber, setIdNumber] = useState('');
  const [state, setState] = useState<SaveState>('idle');

  const save = async () => {
    setState('saving');
    try {
      const body: UpdateHouseholdProfileRequest = {
        history,
        craft,
        craftCategory: craftCategory || null,
        village,
        foundedYear: foundedYear ? Number(foundedYear) : null,
      };
      await client.updateProfile(household.version, body);
      if (idNumber.trim()) {
        await client.setIdNumber({ idNumber: idNumber.trim() });
        setIdNumber('');
      }
      await onSaved();
      setState('idle');
      notify.success(profile('pendingEditor.saved'));
    } catch (error) {
      await onSaved();
      setState(error instanceof ApiError && error.status === 409 ? 'stale' : 'failed');
    }
  };

  return (
    <Card className="flex min-w-0 flex-col gap-4 p-5">
      <h2 className="text-h3">{profile('pendingEditor.title')}</h2>
      <StoryEditor value={history} label={t('storyLabel')} onChange={setHistory} />
      <div className="grid gap-4 md:grid-cols-2">
        <CraftFields
          category={craftCategory}
          detail={craft}
          onCategory={setCraftCategory}
          onDetail={setCraft}
        />
        <label className="flex flex-col gap-1 text-small">
          {profile('pendingEditor.village')}
          <input
            value={village}
            onChange={(event) => setVillage(event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-small">
          {t('foundedYear')}
          <input
            type="number"
            min={1000}
            max={2100}
            value={foundedYear}
            onChange={(event) => setFoundedYear(event.target.value)}
            className={inputClass}
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-small">
        {t('idNumber.replace')}
        <input
          value={idNumber}
          onChange={(event) => setIdNumber(event.target.value)}
          className={inputClass}
          placeholder={household.idNumberMasked ?? undefined}
          inputMode="numeric"
          autoComplete="off"
          maxLength={12}
          aria-invalid={idNumber.trim() !== '' && !isValidIdNumber(idNumber.trim())}
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          disabled={
            state === 'saving' || (idNumber.trim() !== '' && !isValidIdNumber(idNumber.trim()))
          }
          onClick={() => void save()}
        >
          {state === 'saving' ? t('saving') : t('save')}
        </Button>
        {state === 'stale' ? (
          <p role="alert" className="text-small text-seal">
            {t('staleVersion')}
          </p>
        ) : null}
        {state === 'failed' ? (
          <p role="alert" className="text-small text-seal">
            {t('failed')}
          </p>
        ) : null}
      </div>
      <section className="flex min-w-0 flex-col gap-4">
        <h3 className="text-h3">{t('workshop')}</h3>
        {household.workshops.map((workshop) => (
          <WorkshopEditor key={workshop.id} workshop={workshop} client={client} onSaved={onSaved} />
        ))}
        {household.workshops.length === 0 ? (
          <WorkshopEditor workshop={null} client={client} onSaved={onSaved} />
        ) : null}
      </section>
      <div className="border-ink/10 border-t pt-4">
        <h3 className="text-small font-semibold">{profile('pendingEditor.moreDocuments')}</h3>
        <p className="mb-3 text-small text-ash">{profile('pendingEditor.moreDocumentsHint')}</p>
        <DocumentUpload embedded />
      </div>
    </Card>
  );
}
