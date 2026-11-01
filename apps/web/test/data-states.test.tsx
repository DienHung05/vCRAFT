import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EmptyState } from '@/components/states/empty-state';
import { ErrorState } from '@/components/states/error-state';
import {
  ArticleSkeleton,
  CardGridSkeleton,
  DashboardSkeleton,
  DetailSkeleton,
  FormSkeleton,
  ListSkeleton,
  TableSkeleton,
} from '@/components/states/skeletons';
import { renderEn, renderVi } from './render';

describe('skeleton states', () => {
  const skeletons = {
    ListSkeleton,
    TableSkeleton,
    CardGridSkeleton,
    DetailSkeleton,
    ArticleSkeleton,
    FormSkeleton,
    DashboardSkeleton,
  };

  for (const [name, Skeleton] of Object.entries(skeletons)) {
    it(`${name} is one polite busy status with a translated label`, () => {
      renderVi(<Skeleton />);
      const status = screen.getByRole('status');
      expect(status.getAttribute('aria-busy')).toBe('true');
      expect(status.textContent).toContain('Đang tải');
    });
  }

  it('uses a caller label and the English catalog', () => {
    renderEn(<ListSkeleton label="Loading requests…" />);
    expect(screen.getByRole('status').textContent).toBe('Loading requests…');
    renderEn(<ListSkeleton />);
    expect(screen.getAllByRole('status')[1]?.textContent).toBe('Loading…');
  });

  it('hides the placeholder shapes from assistive technology', () => {
    renderVi(<CardGridSkeleton count={3} />);
    const shapes = screen.getByRole('status').querySelectorAll('[aria-hidden="true"]');
    expect(shapes.length).toBeGreaterThan(3);
  });
});

describe('EmptyState', () => {
  it('shows an illustration, a heading, the explanation and the call to action', () => {
    renderVi(
      <EmptyState
        title="Chưa có tin nào."
        description="Tin mới sẽ hiện ở đây."
        action={<a href="/x">Viết tin</a>}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Chưa có tin nào.' })).toBeTruthy();
    expect(screen.getByText('Tin mới sẽ hiện ở đây.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Viết tin' })).toBeTruthy();
    const illustration = screen.getByTestId('empty-state').querySelector('svg');
    expect(illustration?.getAttribute('aria-hidden')).toBe('true');
  });

  it('follows the heading level it is given', () => {
    renderVi(<EmptyState title="Trống" headingLevel="h3" />);
    expect(screen.getByRole('heading', { level: 3, name: 'Trống' })).toBeTruthy();
  });
});

describe('ErrorState', () => {
  it('is an alert whose retry button calls onRetry', () => {
    const onRetry = vi.fn();
    renderVi(<ErrorState message="Không tải được danh sách." onRetry={onRetry} />);
    expect(screen.getByRole('alert').textContent).toContain('Không tải được danh sách.');
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('falls back to the generic message and an English retry label', () => {
    renderEn(<ErrorState onRetry={() => {}} />);
    expect(screen.getByRole('alert').textContent).toMatch(/We could not load this data/);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('shows a custom action instead of a retry button', () => {
    renderVi(<ErrorState action={<a href="/x">Tải lại trang</a>} />);
    expect(screen.queryByRole('button', { name: 'Thử lại' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Tải lại trang' })).toBeTruthy();
  });
});
