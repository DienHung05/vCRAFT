import { type CreateRfqRequest, OnBehalfOfSchema, type RfqResponse } from '@vcraft/contracts';
import { PRODUCT_CATEGORIES, type ProductCategory } from '@vcraft/domain';

/** A file the buyer attached: the uploaded media id and what the form needs to list it. */
export interface RfqAttachmentValue {
  id: string;
  /** Empty for files loaded from a saved draft, which does not keep the original file name. */
  name: string;
  mimeType: string;
  sizeBytes: number;
}

export interface RfqFormValues {
  title: string;
  category: ProductCategory | '';
  description: string;
  customRequirements: string;
  attachments: RfqAttachmentValue[];
  quantity: string;
  unit: string;
  budgetMin: string;
  budgetMax: string;
  deadline: string;
  requiredBy: string;
  destination: string;
  coordinate: boolean;
  householdIds: string[];
  /** The off-platform customer an administrator makes the request for (FR-ORD-10); unused for a buyer. */
  customerName: string;
  customerPhone: string;
  customerEmail: string;
}

export type RfqFormField =
  | 'title'
  | 'category'
  | 'description'
  | 'quantity'
  | 'unit'
  | 'destination'
  | 'deadline'
  | 'requiredBy'
  | 'budget'
  | 'customerName'
  | 'customerPhone'
  | 'customerEmail';
export type RfqFormProblems = Partial<Record<RfqFormField, true>>;

/** Fields a link (for example a product's trace page) may seed on a new form. */
export type RfqFormPrefill = Partial<Pick<RfqFormValues, 'title' | 'category' | 'description'>>;

export const EMPTY_RFQ_FORM: RfqFormValues = {
  title: '',
  category: '',
  description: '',
  customRequirements: '',
  attachments: [],
  quantity: '',
  unit: '',
  budgetMin: '',
  budgetMax: '',
  deadline: '',
  requiredBy: '',
  destination: '',
  coordinate: true,
  householdIds: [],
  customerName: '',
  customerPhone: '',
  customerEmail: '',
};

/** How the form is used: a buyer's own request, or an administrator's request for an off-platform customer. */
export interface RfqFormMode {
  onBehalf?: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** A calendar day in Vietnam ends at 23:59:59 local time, which is what a deadline means here. */
export const endOfDay = (date: string) => new Date(`${date}T23:59:59.000+07:00`);

/**
 * {@link endOfDay} in epoch ms, or null for an empty or invalid date. Households' completion dates use it
 * too, so a promised day is due at its end in Vietnam, like the buyer's dates (GH#443).
 */
export const endOfDayTime = (date: string): number | null => {
  if (date === '') return null;
  const time = endOfDay(date).getTime();
  return Number.isNaN(time) ? null : time;
};

const dateInput = (iso: string) =>
  new Date(new Date(iso).getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);

const wholeNumber = (raw: string) => {
  const value = Number(raw);
  return raw.trim() !== '' && Number.isSafeInteger(value) && value >= 0 ? value : null;
};

/** What the buyer must fix before the request can be saved or sent. */
export function rfqFormProblems(
  values: RfqFormValues,
  now = new Date(),
  mode: RfqFormMode = {},
): RfqFormProblems {
  const problems: RfqFormProblems = {};
  if (!values.title.trim()) problems.title = true;
  if (!values.category) problems.category = true;
  if (!values.description.trim()) problems.description = true;
  const quantity = wholeNumber(values.quantity);
  if (quantity === null || quantity < 1 || quantity > 2_147_483_647) problems.quantity = true;
  if (!values.unit.trim()) problems.unit = true;
  if (!values.destination.trim()) problems.destination = true;
  if (!values.deadline || endOfDay(values.deadline).getTime() - now.getTime() < DAY_MS)
    problems.deadline = true;
  if (
    !values.requiredBy ||
    (values.deadline && endOfDay(values.requiredBy) <= endOfDay(values.deadline))
  )
    problems.requiredBy = true;
  const min = values.budgetMin.trim() ? wholeNumber(values.budgetMin) : undefined;
  const max = values.budgetMax.trim() ? wholeNumber(values.budgetMax) : undefined;
  if (min === null || max === null || (min !== undefined && max !== undefined && min > max))
    problems.budget = true;
  if (mode.onBehalf) {
    // The same rules the API applies: a name, a Vietnamese phone number and an optional valid email.
    const customer = OnBehalfOfSchema.safeParse(customerOf(values));
    if (!customer.success)
      for (const issue of customer.error.issues) {
        if (issue.path[0] === 'name') problems.customerName = true;
        else if (issue.path[0] === 'phone') problems.customerPhone = true;
        else if (issue.path[0] === 'email') problems.customerEmail = true;
      }
  }
  // No chosen household and no coordination is fine: the system matches households of the category (BR-05).
  return problems;
}

function customerOf(values: RfqFormValues) {
  return {
    name: values.customerName.trim(),
    phone: values.customerPhone.trim(),
    ...(values.customerEmail.trim() ? { email: values.customerEmail.trim() } : {}),
  };
}

export function rfqFormPayload(values: RfqFormValues, mode: RfqFormMode = {}): CreateRfqRequest {
  return {
    title: values.title.trim(),
    ...(values.category ? { category: values.category } : {}),
    design: values.description.trim(),
    ...(values.customRequirements.trim()
      ? { customRequirements: values.customRequirements.trim() }
      : {}),
    attachments: values.attachments.map((file) => file.id),
    quantity: Number(values.quantity),
    unit: values.unit.trim(),
    destination: values.destination.trim(),
    requiredBy: endOfDay(values.requiredBy).toISOString(),
    biddingClosesAt: endOfDay(values.deadline).toISOString(),
    // An administrator's request is always coordinated by them and may still invite households up front.
    invitedHouseholdIds: values.coordinate && !mode.onBehalf ? [] : values.householdIds,
    coordinationOptIn: mode.onBehalf ? true : values.coordinate,
    ...(mode.onBehalf ? { onBehalfOf: customerOf(values) } : {}),
    ...(values.budgetMin.trim() ? { budgetMinVnd: Number(values.budgetMin) } : {}),
    ...(values.budgetMax.trim() ? { budgetMaxVnd: Number(values.budgetMax) } : {}),
  };
}

export function rfqFormValues(request: RfqResponse): RfqFormValues {
  return {
    title: request.title,
    category:
      request.category && PRODUCT_CATEGORIES.includes(request.category) ? request.category : '',
    description: request.design,
    customRequirements: request.customRequirements ?? '',
    attachments: (request.attachments ?? []).map((file) => ({
      id: file.id,
      name: '',
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
    })),
    quantity: String(request.quantity),
    unit: request.unit,
    budgetMin: request.budgetMinVnd === null ? '' : String(request.budgetMinVnd),
    budgetMax: request.budgetMaxVnd === null ? '' : String(request.budgetMaxVnd),
    deadline: dateInput(request.biddingClosesAt),
    requiredBy: dateInput(request.requiredBy),
    destination: request.destination,
    coordinate: request.coordinationOptIn,
    householdIds: request.invitedHouseholdIds,
    customerName: request.onBehalfOf?.name ?? '',
    customerPhone: request.onBehalfOf?.phone ?? '',
    customerEmail: request.onBehalfOf?.email ?? '',
  };
}

const STORAGE_KEY = 'vcraft.rfq-draft';

export interface StoredRfqDraft {
  id: string | null;
  values: RfqFormValues;
}

/** Keeps an unfinished form in this browser, because the server only stores complete drafts. */
export function readStoredDraft(): StoredRfqDraft | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredRfqDraft;
    return { id: parsed.id ?? null, values: { ...EMPTY_RFQ_FORM, ...parsed.values } };
  } catch {
    return null;
  }
}

export function writeStoredDraft(draft: StoredRfqDraft) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Storage can be unavailable. The server draft still applies.
  }
}

export function clearStoredDraft() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}
