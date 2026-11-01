import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { type AdminClient, ApiError, type VillageNewsClient } from '@vcraft/api-client';
import type { AdminNewsDto, NewsDetailDto } from '@vcraft/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminNewsForm } from '@/features/admin/admin-news-form';
import { AdminNewsList } from '@/features/admin/admin-news-list';
import { NewsArticleView } from '@/features/news/news-article';
import { VillageArticle, VillageNews } from '@/features/news/village-news';
import { renderVi } from './render';

const push = vi.fn();
vi.mock('@/i18n/navigation', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/x">{children}</a>,
  useRouter: () => ({ push }),
}));
// Tiptap needs layout APIs that jsdom lacks, so the form is tested with a plain textarea.
vi.mock('next/dynamic', () => ({
  default: () =>
    function EditorStub({
      value,
      onChange,
      label,
    }: {
      value: string;
      label: string;
      onChange: (html: string, isEmpty: boolean) => void;
    }) {
      return (
        <textarea
          aria-label={label}
          defaultValue={value}
          onChange={(event) => onChange(event.target.value, event.target.value === '')}
        />
      );
    },
}));
vi.mock('@/components/image-slot', () => ({
  ImageSlot: ({ alt }: { alt: string }) => <span data-testid="cover">{alt}</span>,
}));

const ID = '123e4567-e89b-12d3-a456-426614174000';
const NEWS: AdminNewsDto = {
  id: ID,
  version: 3,
  slug: 'gia-men',
  title: 'Giá men tháng này',
  summary: 'Tóm tắt',
  bodyHtml: '<p>Nội dung</p>',
  category: 'MATERIAL_PRICES',
  visibility: 'PUBLIC',
  pinned: true,
  important: false,
  state: 'PUBLISHED',
  publishedAt: '2026-10-01T00:00:00.000Z',
  cover: null,
  householdName: null,
  updatedAt: '2026-10-01T00:00:00.000Z',
};
const ARTICLE: NewsDetailDto = {
  slug: 'gia-men',
  title: 'Giá men tháng này',
  summary: 'Tóm tắt',
  category: 'MATERIAL_PRICES',
  pinned: false,
  publishedAt: '2026-10-01T00:00:00.000Z',
  householdName: null,
  householdSlug: null,
  cover: {
    mediaId: ID,
    url: 'https://cdn.test/a.webp',
    width: null,
    height: null,
    variants: [],
    alt: 'Ảnh men',
    caption: null,
    credit: null,
  },
  body: 'Nội dung',
  bodyHtml: '<h2>Tiêu đề phụ</h2><p>Nội dung chính</p>',
  visibility: 'PUBLIC',
  related: [
    {
      slug: 'tin-khac',
      title: 'Tin liên quan khác',
      summary: 'x',
      category: 'MATERIAL_PRICES',
      pinned: false,
      publishedAt: '2026-09-01T00:00:00.000Z',
      householdName: null,
      householdSlug: null,
      cover: null,
    },
  ],
};
const asAdmin = (methods: object) => methods as unknown as AdminClient;
const asVillage = (methods: object) => methods as unknown as VillageNewsClient;

describe('NewsArticleView', () => {
  it('shows the cover, category, sanitized body and related news', () => {
    renderVi(<NewsArticleView article={ARTICLE} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Giá men tháng này' })).toBeTruthy();
    expect(screen.getByTestId('cover').textContent).toBe('Ảnh men');
    expect(screen.getByText('Giá nguyên vật liệu')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Tiêu đề phụ' })).toBeTruthy();
    expect(screen.getByText('Tin liên quan khác')).toBeTruthy();
  });

  it('shows older plain-text items as text, never as markup', () => {
    renderVi(
      <NewsArticleView article={{ ...ARTICLE, bodyHtml: null, body: '<b>not markup</b>' }} />,
    );
    expect(screen.getByTestId('news-body').textContent).toBe('<b>not markup</b>');
    expect(screen.getByTestId('news-body').querySelector('b')).toBeNull();
  });
});

describe('Village news', () => {
  it('shows a village-only article to a member and a plain message to anyone else', async () => {
    const { unmount } = renderVi(
      <VillageArticle
        slug="gia-men"
        client={asVillage({
          get: vi.fn().mockResolvedValue({ ...ARTICLE, visibility: 'VILLAGE' }),
        })}
      />,
    );
    expect(await screen.findByText('Chỉ hộ trong làng')).toBeTruthy();
    unmount();
    renderVi(
      <VillageArticle
        slug="gia-men"
        client={asVillage({ get: vi.fn().mockRejectedValue(new ApiError('NOT_FOUND', 404)) })}
      />,
    );
    expect(await screen.findByText(/Không tìm thấy tin này/)).toBeTruthy();
  });

  it('renders nothing on the news page for people outside the village', async () => {
    const list = vi.fn().mockRejectedValue(new ApiError('AUTH_UNAUTHENTICATED', 401));
    const { container } = renderVi(<VillageNews client={asVillage({ list })} />);
    await waitFor(() => expect(list).toHaveBeenCalled());
    expect(container.querySelector('section')).toBeNull();
  });
});

describe('AdminNewsList', () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal ??= vi.fn();
    HTMLDialogElement.prototype.close ??= vi.fn();
  });

  it('lists items with state, passes the filter and deletes after confirming', async () => {
    const listNews = vi
      .fn()
      .mockResolvedValueOnce({ data: [NEWS], nextCursor: null })
      .mockResolvedValue({ data: [], nextCursor: null });
    const deleteNews = vi.fn().mockResolvedValue(undefined);
    renderVi(<AdminNewsList client={asAdmin({ listNews, deleteNews })} />);
    expect(await screen.findByText('Giá men tháng này')).toBeTruthy();
    const list = within(screen.getByTestId('admin-news'));
    expect(list.getByText('Đã đăng')).toBeTruthy();
    expect(list.getByText('Ghim')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Xóa' }));
    const dialog = (await screen.findByText('Xóa tin này?')).closest('dialog') as HTMLElement;
    const confirm = Array.from(dialog.querySelectorAll('button')).find(
      (button) => button.textContent === 'Xóa',
    ) as HTMLElement;
    fireEvent.click(confirm);
    await waitFor(() => expect(deleteNews).toHaveBeenCalledWith(ID, 3));
    expect(await screen.findByText('Chưa có tin nào.')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'SCHEDULED' } });
    await waitFor(() => expect(listNews).toHaveBeenLastCalledWith({ state: 'SCHEDULED' }));
  });
});

describe('AdminNewsForm', () => {
  beforeEach(() => push.mockClear());

  const fill = async () => {
    fireEvent.change(await screen.findByLabelText('Tiêu đề'), { target: { value: 'Tin mới' } });
    fireEvent.change(screen.getByLabelText('Tóm tắt'), { target: { value: 'Tóm tắt' } });
    fireEvent.change(screen.getByLabelText('Nội dung'), { target: { value: '<p>Thân bài</p>' } });
  };

  it('shows what is missing and does not save', async () => {
    const createNews = vi.fn();
    renderVi(<AdminNewsForm client={asAdmin({ createNews })} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Lưu' }));
    expect(await screen.findByText('Hãy nhập tiêu đề.')).toBeTruthy();
    expect(screen.getByText('Hãy nhập nội dung.')).toBeTruthy();
    expect(createNews).not.toHaveBeenCalled();
  });

  it('saves a draft by default, then returns to the list', async () => {
    const createNews = vi.fn().mockResolvedValue(NEWS);
    renderVi(<AdminNewsForm client={asAdmin({ createNews })} />);
    await fill();
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() =>
      expect(createNews).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Tin mới',
          bodyHtml: '<p>Thân bài</p>',
          status: 'DRAFT',
          visibility: 'PUBLIC',
        }),
      ),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith('/admin/tin-tuc'));
  });

  it('schedules with visibility, pinning and importance, and requires a future time', async () => {
    const createNews = vi.fn().mockResolvedValue(NEWS);
    renderVi(<AdminNewsForm client={asAdmin({ createNews })} />);
    await fill();
    fireEvent.change(screen.getByLabelText('Phạm vi hiển thị'), { target: { value: 'VILLAGE' } });
    fireEvent.click(screen.getByLabelText('Ghim lên đầu danh sách'));
    fireEvent.click(screen.getByLabelText(/Tin quan trọng/));
    fireEvent.click(screen.getByLabelText('Hẹn giờ đăng'));
    const when = screen.getByLabelText('Thời điểm đăng');
    fireEvent.change(when, { target: { value: '2020-01-01T10:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(await screen.findByText('Hãy chọn thời điểm trong tương lai.')).toBeTruthy();
    expect(createNews).not.toHaveBeenCalled();

    fireEvent.change(when, { target: { value: '2099-01-01T10:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(createNews).toHaveBeenCalled());
    expect(createNews.mock.calls[0]?.[0]).toMatchObject({
      status: 'PUBLISHED',
      visibility: 'VILLAGE',
      pinned: true,
      important: true,
      publishAt: new Date('2099-01-01T10:00').toISOString(),
    });
  });

  it('edits with the loaded version, and uploads a new cover first', async () => {
    const updateNews = vi.fn().mockResolvedValue(NEWS);
    const upload = vi.fn().mockResolvedValue('cover-id');
    renderVi(
      <AdminNewsForm
        newsId={ID}
        upload={upload}
        client={asAdmin({ getNews: vi.fn().mockResolvedValue(NEWS), updateNews })}
      />,
    );
    await waitFor(() =>
      expect((screen.getByLabelText('Tiêu đề') as HTMLInputElement).value).toBe(NEWS.title),
    );
    fireEvent.change(screen.getByLabelText('Ảnh bìa'), {
      target: { files: [new File(['x'], 'c.jpg', { type: 'image/jpeg' })] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() =>
      expect(updateNews).toHaveBeenCalledWith(
        ID,
        3,
        expect.objectContaining({ coverMediaId: 'cover-id', status: 'PUBLISHED' }),
      ),
    );
  });

  it('explains a taken slug and a conflicting edit', async () => {
    const createNews = vi
      .fn()
      .mockRejectedValueOnce(new ApiError('CONFLICT_DUPLICATE', 409))
      .mockRejectedValueOnce(new ApiError('STALE_VERSION', 409));
    renderVi(<AdminNewsForm client={asAdmin({ createNews })} />);
    await fill();
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(await screen.findByText(/Đường dẫn này đã có tin khác dùng/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(await screen.findByText(/vừa được người khác sửa/)).toBeTruthy();
  });
});
