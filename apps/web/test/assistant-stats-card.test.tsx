import { screen } from '@testing-library/react';
import type { AdminClient } from '@vcraft/api-client';
import { describe, expect, it, vi } from 'vitest';
import { AssistantStatsCard } from '@/features/admin/assistant-stats-card';
import { renderEn, renderVi } from './render';

const client = (impl: () => Promise<unknown>) =>
  ({ assistantStats: vi.fn(impl) }) as unknown as AdminClient;

describe('AssistantStatsCard (GH#82)', () => {
  it('shows turns, block rate, ratings, latency and unanswered questions', async () => {
    renderVi(
      <AssistantStatsCard
        client={client(async () => ({
          days: 7,
          turns: 120,
          blocked: 6,
          blockRate: 0.05,
          limited: 11,
          disabled: 2,
          failures: 7,
          unansweredCount: 9,
          feedback: { up: 30, down: 4 },
          firstTokenMs: { p50: 640, p95: 1800 },
          unanswered: [{ question: 'Có ship sang Nhật không?', count: 3 }],
        }))}
      />,
    );
    expect(await screen.findByText('120')).toBeTruthy();
    expect(screen.getByText('5%')).toBeTruthy();
    // Limits, the kill switch and errors are shown apart from guardrail blocks.
    expect(screen.getByText('Vượt giới hạn').nextElementSibling?.textContent).toBe('11');
    expect(screen.getByText('Trợ lý đang tắt').nextElementSibling?.textContent).toBe('2');
    expect(screen.getByText('Lỗi hệ thống').nextElementSibling?.textContent).toBe('7');
    expect(screen.getByText('Chưa trả lời được').nextElementSibling?.textContent).toBe('9');
    expect(screen.getByText('👍 30 · 👎 4')).toBeTruthy();
    expect(screen.getByText('640 ms / 1800 ms')).toBeTruthy();
    expect(screen.getByText('Có ship sang Nhật không?')).toBeTruthy();
    expect(screen.getByText('3 lần')).toBeTruthy();
  });

  it('says so when there is nothing to show or the figures fail', async () => {
    renderEn(
      <AssistantStatsCard
        client={client(async () => ({
          days: 7,
          turns: 0,
          blocked: 0,
          blockRate: 0,
          limited: 0,
          disabled: 0,
          failures: 0,
          unansweredCount: 0,
          feedback: { up: 0, down: 0 },
          firstTokenMs: { p50: null, p95: null },
          unanswered: [],
        }))}
      />,
    );
    expect(await screen.findByText('No unanswered questions yet.')).toBeTruthy();
    expect(screen.getByText('— / —')).toBeTruthy();
  });

  it('keeps the dashboard usable when the assistant figures fail', async () => {
    renderEn(<AssistantStatsCard client={client(async () => Promise.reject(new Error('503')))} />);
    expect(await screen.findByText('The assistant figures could not be loaded.')).toBeTruthy();
  });
});
