import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RichTextEditor } from '@/features/admin/rich-text-editor';
import { renderVi } from './render';

describe('RichTextEditor', () => {
  it('loads existing HTML and reports formatting changes as HTML', async () => {
    const onChange = vi.fn();
    renderVi(<RichTextEditor value="<p>Xin chào</p>" label="Nội dung" onChange={onChange} />);
    const box = await screen.findByRole('textbox', { name: 'Nội dung' });
    await waitFor(() => expect(box.textContent).toBe('Xin chào'));

    const bold = screen.getByRole('button', { name: 'Đậm' });
    await waitFor(() => expect((bold as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'Danh sách' }));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const [html, isEmpty] = onChange.mock.lastCall as [string, boolean];
    expect(html).toContain('<ul>');
    expect(html).toContain('Xin chào');
    expect(isEmpty).toBe(false);
  });
});
