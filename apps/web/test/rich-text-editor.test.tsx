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

  it('survives the deferred focus scroll that tiptap runs in an animation frame', async () => {
    renderVi(<RichTextEditor value="<p>Xin chào</p>" label="Nội dung" onChange={vi.fn()} />);
    const bold = await screen.findByRole('button', { name: 'Đậm' });
    await waitFor(() => expect((bold as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(bold);
    // focus() calls scrollIntoView in a requestAnimationFrame; let it run inside the test so a
    // failure there is attributed to this test rather than a random later one.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
    expect(screen.getByRole('textbox', { name: 'Nội dung' })).toBeTruthy();
  });
});
