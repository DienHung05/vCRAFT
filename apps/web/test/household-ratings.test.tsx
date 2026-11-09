import { fireEvent, screen, waitFor } from '@testing-library/react';
import { QuotationApiError, type QuotationClient } from '@vcraft/api-client';
import type { AllocationDto, HouseholdRatingDto } from '@vcraft/contracts';
import { describe, expect, it, vi } from 'vitest';
import { HouseholdRatings } from '@/features/rfq/household-ratings';
import { RatingSummary } from '@/features/rfq/star-rating';
import { renderVi } from './render';

const REQUEST_ID = '123e4567-e89b-12d3-a456-426614174000';
const HOUSEHOLD_A = '00000000-0000-4000-8000-00000000000a';
const HOUSEHOLD_B = '00000000-0000-4000-8000-00000000000b';
const HOUSEHOLD_C = '00000000-0000-4000-8000-00000000000c';

const share = (householdId: string, householdName: string, status = 'DONE'): AllocationDto =>
  ({
    id: `alloc-${householdId}`,
    version: 1,
    householdId,
    householdName,
    quantity: 10,
    completedQty: 10,
    status,
  }) as unknown as AllocationDto;

const SHARES = [
  share(HOUSEHOLD_A, 'Gốm A'),
  share(HOUSEHOLD_B, 'Gốm B'),
  share(HOUSEHOLD_C, 'Gốm C', 'CANCELLED'),
];

const rating = (householdId: string, overrides: Partial<HouseholdRatingDto> = {}) => ({
  householdId,
  stars: 3,
  comment: 'Fine',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  editableUntil: new Date(Date.now() + 20 * 86_400_000).toISOString(),
  ...overrides,
});

const asClient = (rateHousehold: ReturnType<typeof vi.fn>) =>
  ({ rateHousehold }) as unknown as QuotationClient;

const radios = (name: string) =>
  [
    ...screen.getByRole('radiogroup', { name }).querySelectorAll('input[type="radio"]'),
  ] as HTMLInputElement[];
const saveButtons = () =>
  screen.getAllByRole('button', { name: 'Lưu đánh giá' }) as HTMLButtonElement[];

describe('HouseholdRatings', () => {
  it('offers a star radio group and a comment per household that finished a share', () => {
    renderVi(
      <HouseholdRatings
        client={asClient(vi.fn())}
        requestId={REQUEST_ID}
        shares={SHARES}
        ratings={[]}
      />,
    );
    expect(screen.getByRole('radiogroup', { name: 'Số sao dành cho Gốm A' })).toBeTruthy();
    expect(screen.getByRole('radiogroup', { name: 'Số sao dành cho Gốm B' })).toBeTruthy();
    // A cancelled share did no work, so there is nobody to rate.
    expect(screen.queryByRole('radiogroup', { name: 'Số sao dành cho Gốm C' })).toBeNull();
    // Native radios sharing a name: Tab enters once and the arrow keys move between stars.
    const group = radios('Số sao dành cho Gốm A');
    expect(group).toHaveLength(5);
    expect(new Set(group.map((radio) => radio.name)).size).toBe(1);
    expect(screen.getAllByLabelText(/^Nhận xét về/)).toHaveLength(2);
  });

  it('saves the stars and the comment for one household only', async () => {
    const rateHousehold = vi.fn().mockResolvedValue(rating(HOUSEHOLD_A, { stars: 4 }));
    const onSaved = vi.fn();
    renderVi(
      <HouseholdRatings
        client={asClient(rateHousehold)}
        requestId={REQUEST_ID}
        shares={SHARES}
        ratings={[]}
        onSaved={onSaved}
      />,
    );
    fireEvent.click(radios('Số sao dành cho Gốm A')[3] as HTMLInputElement);
    fireEvent.change(screen.getByLabelText(/^Nhận xét về Gốm A/), {
      target: { value: '  Làm rất kỹ  ' },
    });
    fireEvent.click(saveButtons()[0] as HTMLElement);
    await waitFor(() =>
      expect(rateHousehold).toHaveBeenCalledWith(REQUEST_ID, HOUSEHOLD_A, {
        stars: 4,
        comment: 'Làm rất kỹ',
      }),
    );
    expect(rateHousehold).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Đã lưu đánh giá.')).toBeTruthy();
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('asks for the stars before saving', async () => {
    const rateHousehold = vi.fn();
    renderVi(
      <HouseholdRatings
        client={asClient(rateHousehold)}
        requestId={REQUEST_ID}
        shares={SHARES}
        ratings={[]}
      />,
    );
    fireEvent.click(saveButtons()[0] as HTMLElement);
    expect(await screen.findByText('Hãy chọn số sao.')).toBeTruthy();
    expect(rateHousehold).not.toHaveBeenCalled();
  });

  it('shows a saved rating and locks it once the edit window has closed', () => {
    renderVi(
      <HouseholdRatings
        client={asClient(vi.fn())}
        requestId={REQUEST_ID}
        shares={SHARES}
        ratings={[
          rating(HOUSEHOLD_A, { stars: 5 }),
          rating(HOUSEHOLD_B, { stars: 2, editableUntil: '2020-01-01T00:00:00.000Z' }),
        ]}
      />,
    );
    expect(radios('Số sao dành cho Gốm A')[4]?.checked).toBe(true);
    expect(radios('Số sao dành cho Gốm B')[1]?.checked).toBe(true);
    expect(radios('Số sao dành cho Gốm B')[1]?.disabled).toBe(true);
    expect(screen.getByText(/Đã quá 30 ngày/)).toBeTruthy();
    expect(saveButtons()[1]?.disabled).toBe(true);
  });

  it('reports a closed window the server refuses and a failed save', async () => {
    const rateHousehold = vi
      .fn()
      .mockRejectedValueOnce(new QuotationApiError('BUSINESS_RULE_VIOLATED', 409))
      .mockRejectedValueOnce(new QuotationApiError('INTERNAL_ERROR', 500));
    renderVi(
      <HouseholdRatings
        client={asClient(rateHousehold)}
        requestId={REQUEST_ID}
        shares={[share(HOUSEHOLD_A, 'Gốm A'), share(HOUSEHOLD_B, 'Gốm B')]}
        ratings={[]}
      />,
    );
    fireEvent.click(radios('Số sao dành cho Gốm B')[0] as HTMLInputElement);
    fireEvent.click(saveButtons()[1] as HTMLElement);
    expect(await screen.findByText(/Đã quá 30 ngày/)).toBeTruthy();
    fireEvent.click(radios('Số sao dành cho Gốm A')[0] as HTMLInputElement);
    fireEvent.click(saveButtons()[0] as HTMLElement);
    expect(await screen.findByText('Không lưu được đánh giá. Vui lòng thử lại.')).toBeTruthy();
  });
});

describe('RatingSummary', () => {
  it('shows the mean with one decimal and the count, or that nobody rated yet', () => {
    const { unmount } = renderVi(<RatingSummary average={4.3} count={7} />);
    expect(screen.getByRole('img', { name: /4,3 trên 5 từ 7 đánh giá/ })).toBeTruthy();
    unmount();
    renderVi(<RatingSummary average={null} count={0} />);
    expect(screen.getByText('Chưa có đánh giá')).toBeTruthy();
  });
});
