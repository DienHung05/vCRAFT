import { screen } from '@testing-library/react';
import type { AdminClient } from '@vcraft/api-client';
import { expect, it, vi } from 'vitest';
import { HouseholdQueue } from '@/features/admin/household-queue';
import { HouseholdReview } from '@/features/admin/household-review';
import { renderVi } from './render';

vi.mock('next/dynamic', () => ({ default: () => () => null }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/review">{children}</a>,
}));

it('groups classified and legacy evidence and describes the workshop boundary without the map', async () => {
  const client = {
    getHousehold: async () => ({
      id: 'household',
      version: 3,
      name: 'Application',
      status: 'PENDING_REVIEW',
      history: '',
      certifications: [],
      artisans: [],
      statusReason: null,
      workshops: [
        { id: 'workshop', name: 'Outside workshop', address: 'Address', lat: 21.05, lng: 106 },
      ],
    }),
    documents: async () => ({
      data: [
        { id: 'identity', mimeType: 'application/pdf', certificateKind: 'IDENTITY' },
        { id: 'legacy', mimeType: 'image/png' },
      ],
    }),
  } as unknown as AdminClient;
  renderVi(<HouseholdReview householdId="household" client={client} />);
  expect(await screen.findByRole('heading', { name: /Căn cước công dân/ })).toBeDefined();
  expect(screen.getByRole('heading', { name: /Giấy tờ chưa phân loại/ })).toBeDefined();
  expect(screen.getAllByRole('button', { name: /^Mở / })).toHaveLength(2);
  expect(
    screen.getByRole('img', { name: 'Ranh giới Bát Tràng và vị trí của 1 xưởng' }),
  ).toBeDefined();
  expect(screen.getByText('Ghim ngoài ranh giới xã Bát Tràng')).toBeDefined();
});

it('distinguishes applications waiting for an answer from explicit resubmissions in the queue', async () => {
  const client = {
    listHouseholds: async () =>
      ['AWAITING_APPLICANT', 'RESUBMITTED'].map((reviewState, index) => ({
        id: String(index),
        name: `Household ${index}`,
        status: 'PENDING_REVIEW',
        reviewState,
        submittedAt: '2026-11-08T01:00:00.000Z',
      })),
  } as unknown as AdminClient;
  renderVi(<HouseholdQueue client={client} />);
  expect(await screen.findByText('Chờ hộ bổ sung')).toBeDefined();
  expect(screen.getByText('Đã bổ sung và nộp lại')).toBeDefined();
});
