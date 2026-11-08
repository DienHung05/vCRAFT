'use client';

import { QuotationApiError, type QuotationClient } from '@vcraft/api-client';
import type { HouseholdSummaryDto, RfqResponse } from '@vcraft/contracts';
import { PRIVACY_POLICY_VERSION, PRODUCT_CATEGORIES } from '@vcraft/domain';
import { Button } from '@vcraft/ui';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { AmountInWords } from '@/components/amount-in-words';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { ConsentCheckbox } from '@/components/consent-checkbox';
import { FormSkeleton } from '@/components/states/skeletons';
import { Reveal } from '@/experience/motion/reveal';
import { useRouter } from '@/i18n/navigation';
import { useAddressSuggestions } from '@/lib/address/use-address-suggestions';
import { useQuotationClient } from '@/lib/api/use-quotation-client';
import { notify } from '@/lib/notify';
import { AttachmentsField } from './rfq-attachments';
import {
  clearStoredDraft,
  EMPTY_RFQ_FORM,
  type RfqAttachmentValue,
  type RfqFormField,
  type RfqFormPrefill,
  type RfqFormValues,
  readStoredDraft,
  rfqFormPayload,
  rfqFormProblems,
  rfqFormValues,
  writeStoredDraft,
} from './rfq-form-model';

const AUTOSAVE_MS = 800;
const inputClass = 'w-full rounded-input border border-ink/20 bg-surface px-3 py-2 text-body';

type SaveState = 'idle' | 'saving' | 'saved' | 'local' | 'failed';

/**
 * Create form for a quotation request (FR-RFQ-01, 02). `draft` continues a saved server draft;
 * `prefill` seeds a new form (for example from a product's trace page) and wins over a browser-kept one.
 */
export function RfqForm({
  client: provided,
  draft,
  prefill,
  upload,
}: {
  client?: QuotationClient;
  draft?: RfqResponse;
  prefill?: RfqFormPrefill;
  /** Sends one attachment; replaced in tests. */
  upload?: (file: File) => Promise<RfqAttachmentValue>;
}) {
  const t = useTranslations('rfq.form');
  const { client, loading } = useQuotationClient(provided);
  if (loading) return <FormSkeleton label={t('saving')} />;
  if (!client) return <p className="px-gutter pt-8">{t('signIn')}</p>;
  return <Form client={client} draft={draft} prefill={prefill} upload={upload} />;
}

function Form({
  client,
  draft,
  prefill,
  upload,
}: {
  client: QuotationClient;
  draft?: RfqResponse | undefined;
  prefill?: RfqFormPrefill | undefined;
  upload?: ((file: File) => Promise<RfqAttachmentValue>) | undefined;
}) {
  const t = useTranslations('rfq.form');
  const categories = useTranslations('catalog.categories');
  const rfq = useTranslations('rfq');
  const common = useTranslations('common');
  const router = useRouter();
  const [values, setValues] = useState<RfqFormValues>(() =>
    draft ? rfqFormValues(draft) : { ...EMPTY_RFQ_FORM, ...prefill },
  );
  const destinationListId = useId();
  const destinationSuggestions = useAddressSuggestions(values.destination);
  // A saved draft already went through consent when it was first created.
  const [consent, setConsent] = useState(draft !== undefined);
  const [touched, setTouched] = useState(false);
  const [showProblems, setShowProblems] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sendError, setSendError] = useState<'sendFailed' | 'emailNotVerified' | 'noMatch' | null>(
    null,
  );
  const [households, setHouseholds] = useState<readonly HouseholdSummaryDto[] | null>(null);
  const [householdsFailed, setHouseholdsFailed] = useState(false);
  const saved = useRef<{ id: string; version: number } | null>(
    draft ? { id: draft.id, version: draft.version } : null,
  );
  const saving = useRef<Promise<void>>(Promise.resolve());

  // A new form restores what this browser kept, including the server draft it belongs to.
  useEffect(() => {
    if (draft || prefill) return;
    const stored = readStoredDraft();
    if (!stored) return;
    setValues(stored.values);
    if (!stored.id) return;
    client
      .getRequest(stored.id)
      .then((request) => {
        if (request.status === 'DRAFT')
          saved.current = { id: request.id, version: request.version };
        else {
          clearStoredDraft();
          setValues(EMPTY_RFQ_FORM);
        }
      })
      .catch(() => clearStoredDraft());
  }, [client, draft, prefill]);

  const saveToServer = useCallback(
    (current: RfqFormValues) => {
      // Saves run one after another, so each one sends the version the previous one returned.
      saving.current = saving.current.then(async () => {
        const payload = rfqFormPayload(current);
        // The request carries a delivery address: the consent is recorded before the first save.
        if (!saved.current) await client.recordConsent('RFQ_CONTACT', PRIVACY_POLICY_VERSION);
        const response = saved.current
          ? await client.updateRequest(saved.current.id, saved.current.version, payload)
          : await client.createRequest(payload);
        saved.current = { id: response.id, version: response.version };
      });
      return saving.current;
    },
    [client],
  );

  useEffect(() => {
    if (!touched) return;
    const timer = window.setTimeout(() => {
      if (!draft) writeStoredDraft({ id: saved.current?.id ?? null, values });
      // Nothing personal (the delivery address) leaves this browser before the buyer consents.
      if (!consent || Object.keys(rfqFormProblems(values)).length > 0) {
        setSaveState('local');
        return;
      }
      setSaveState('saving');
      saveToServer(values)
        .then(() => {
          if (!draft) writeStoredDraft({ id: saved.current?.id ?? null, values });
          setSaveState('saved');
        })
        .catch(() => {
          // A failed link must not block the ones behind it.
          saving.current = Promise.resolve();
          setSaveState('failed');
        });
    }, AUTOSAVE_MS);
    return () => window.clearTimeout(timer);
  }, [values, touched, consent, draft, saveToServer]);

  useEffect(() => {
    if (values.coordinate || households !== null) return;
    client
      .listHouseholds()
      .then((list) => setHouseholds(list.data))
      .catch(() => setHouseholdsFailed(true));
  }, [values.coordinate, households, client]);

  const set = <K extends keyof RfqFormValues>(key: K, value: RfqFormValues[K]) => {
    setTouched(true);
    setValues((current) => ({ ...current, [key]: value }));
  };

  const problems = rfqFormProblems(values);
  const problem = (field: RfqFormField) =>
    showProblems && problems[field] ? (
      <span id={`rfq-${field}-problem`} role="alert" className="text-small text-seal">
        {t(`problem.${field}`)}
      </span>
    ) : null;
  const invalid = (field: RfqFormField) =>
    showProblems && problems[field]
      ? { 'aria-invalid': true, 'aria-describedby': `rfq-${field}-problem` }
      : {};

  const send = async () => {
    setSendError(null);
    if (Object.keys(problems).length > 0 || !consent) {
      setShowProblems(true);
      return;
    }
    setSending(true);
    try {
      await saveToServer(values);
      const target = saved.current;
      if (!target) throw new Error('draft was not saved');
      const sent = await client.submitRequest(target.id, target.version);
      clearStoredDraft();
      // With no chosen household the system matched some: the buyer is told how many (FR-RFQ-03).
      notify.success(
        sent.invitedHouseholdIds.length > 0
          ? t('sentToastMatched', { count: sent.invitedHouseholdIds.length })
          : t('sentToast'),
      );
      router.push({ pathname: '/yeu-cau-bao-gia/[code]', params: { code: sent.id } });
    } catch (error) {
      saving.current = Promise.resolve();
      setSendError(
        error instanceof QuotationApiError && error.code === 'AUTH_EMAIL_NOT_VERIFIED'
          ? 'emailNotVerified'
          : error instanceof QuotationApiError && error.code === 'RFQ_NO_MATCHING_HOUSEHOLD'
            ? 'noMatch'
            : 'sendFailed',
      );
    } finally {
      setSending(false);
    }
  };

  const status =
    saveState === 'saving'
      ? t('saving')
      : saveState === 'saved'
        ? t('saved')
        : saveState === 'local'
          ? t('savedLocal')
          : saveState === 'failed'
            ? t('saveFailed')
            : null;

  return (
    <form
      noValidate
      className={
        draft
          ? 'flex flex-col gap-5'
          : 'mx-auto flex max-w-prose-vn flex-col gap-5 px-gutter pt-12 pb-section-tail'
      }
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      {draft ? null : (
        <header className="flex flex-col gap-2">
          <Breadcrumbs
            className="mb-2"
            items={[
              { label: common('home'), href: '/' },
              { label: rfq('allRequests'), href: '/yeu-cau-bao-gia' },
              { label: t('title') },
            ]}
          />
          <h1 className="text-h1">{t('title')}</h1>
          <p className="text-ash">{t('lead')}</p>
        </header>
      )}
      <label className="flex flex-col gap-1">
        {t('requestTitle')}
        <input
          value={values.title}
          maxLength={200}
          onChange={(event) => set('title', event.target.value)}
          className={inputClass}
          {...invalid('title')}
        />
        {problem('title')}
      </label>
      <label className="flex flex-col gap-1">
        {t('category')}
        <select
          value={values.category}
          onChange={(event) => set('category', event.target.value as RfqFormValues['category'])}
          className={inputClass}
          {...invalid('category')}
        >
          <option value="">{t('chooseCategory')}</option>
          {PRODUCT_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {categories(category)}
            </option>
          ))}
        </select>
        {problem('category')}
      </label>
      <label className="flex flex-col gap-1">
        {t('description')}
        <textarea
          value={values.description}
          rows={4}
          maxLength={500}
          onChange={(event) => set('description', event.target.value)}
          className={inputClass}
          {...invalid('description')}
        />
        {problem('description')}
      </label>
      <label className="flex flex-col gap-1">
        {t('customRequirements')}
        <textarea
          value={values.customRequirements}
          rows={3}
          maxLength={1000}
          onChange={(event) => set('customRequirements', event.target.value)}
          className={inputClass}
        />
        <span className="text-small text-ash">{t('customRequirementsHint')}</span>
      </label>
      <AttachmentsField
        value={values.attachments}
        onChange={(next) => set('attachments', next)}
        onBusyChange={setUploading}
        {...(upload ? { upload } : {})}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          {t('quantity')}
          <input
            inputMode="numeric"
            value={values.quantity}
            onChange={(event) => set('quantity', event.target.value)}
            className={inputClass}
            {...invalid('quantity')}
          />
          {problem('quantity')}
        </label>
        <label className="flex flex-col gap-1">
          {t('unit')}
          <input
            value={values.unit}
            maxLength={30}
            onChange={(event) => set('unit', event.target.value)}
            className={inputClass}
            {...invalid('unit')}
          />
          {problem('unit')}
        </label>
        <div className="flex flex-col gap-1">
          <label className="flex flex-col gap-1">
            {t('budgetMin')}
            <input
              inputMode="numeric"
              value={values.budgetMin}
              onChange={(event) => set('budgetMin', event.target.value)}
              className={inputClass}
              {...invalid('budget')}
            />
          </label>
          <AmountInWords value={values.budgetMin} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="flex flex-col gap-1">
            {t('budgetMax')}
            <input
              inputMode="numeric"
              value={values.budgetMax}
              onChange={(event) => set('budgetMax', event.target.value)}
              className={inputClass}
              {...invalid('budget')}
            />
          </label>
          <AmountInWords value={values.budgetMax} />
        </div>
      </div>
      {problem('budget')}
      <Reveal className="flex flex-col gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            {t('deadline')}
            <input
              type="date"
              value={values.deadline}
              onChange={(event) => set('deadline', event.target.value)}
              className={inputClass}
              {...invalid('deadline')}
            />
            {problem('deadline')}
          </label>
          <label className="flex flex-col gap-1">
            {t('requiredBy')}
            <input
              type="date"
              value={values.requiredBy}
              onChange={(event) => set('requiredBy', event.target.value)}
              className={inputClass}
              {...invalid('requiredBy')}
            />
            {problem('requiredBy')}
          </label>
        </div>
        <label className="flex flex-col gap-1">
          {t('destination')}
          <input
            value={values.destination}
            maxLength={300}
            list={destinationListId}
            autoComplete="off"
            onChange={(event) => set('destination', event.target.value)}
            className={inputClass}
            {...invalid('destination')}
          />
          <datalist id={destinationListId}>
            {destinationSuggestions.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
          {problem('destination')}
        </label>
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={values.coordinate}
            onChange={(event) => set('coordinate', event.target.checked)}
            className="mt-1"
          />
          <span className="flex flex-col">
            {t('coordinate')}
            <span className="text-small text-ash">{t('coordinateHint')}</span>
          </span>
        </label>
        {values.coordinate ? null : (
          <fieldset className="flex flex-col gap-2">
            <legend>{t('households')}</legend>
            <p className="text-small text-ash">{t('householdsMatch')}</p>
            {householdsFailed ? (
              <p role="alert">{t('householdsFailed')}</p>
            ) : households === null ? (
              <p role="status">{t('householdsLoading')}</p>
            ) : (
              households.map((household) => (
                <label key={household.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={values.householdIds.includes(household.id)}
                    onChange={(event) =>
                      set(
                        'householdIds',
                        event.target.checked
                          ? [...values.householdIds, household.id]
                          : values.householdIds.filter((id) => id !== household.id),
                      )
                    }
                  />
                  {household.name}
                </label>
              ))
            )}
          </fieldset>
        )}
      </Reveal>
      <ConsentCheckbox
        id="rfq-consent"
        purpose="quote"
        checked={consent}
        onChange={(event) => {
          setTouched(true);
          setConsent(event.target.checked);
        }}
        error={showProblems && !consent ? t('consentRequired') : undefined}
      />
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={sending || uploading}>
          {t(sending ? 'sending' : 'send')}
        </Button>
        {status ? (
          <p role="status" className="text-small text-ash">
            {status}
          </p>
        ) : null}
      </div>
      {sendError ? (
        <p role="alert" className="text-seal">
          {t(sendError)}
        </p>
      ) : null}
    </form>
  );
}
