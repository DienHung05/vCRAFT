import { fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PhotoPicker } from '@/components/photo-picker';
import { renderVi } from './render';

const LABEL = 'Ảnh tiến độ';

function Harness({ onChange }: { onChange: (file: File | null) => void }) {
  const [picked, setPicked] = useState<File | null>(null);
  return (
    <PhotoPicker
      label={LABEL}
      accept="image/*"
      file={picked}
      onChange={(next) => {
        onChange(next);
        setPicked(next);
      }}
    />
  );
}

describe('PhotoPicker', () => {
  it('shows the label, the upload button text and an empty state', () => {
    renderVi(<PhotoPicker label={LABEL} accept="image/*" file={null} onChange={() => {}} />);
    expect(screen.getByText(LABEL)).toBeTruthy();
    expect(screen.getByText('Tải ảnh')).toBeTruthy();
    expect(screen.getByText('Chưa chọn ảnh')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Bỏ chọn' })).toBeNull();
  });

  it('keeps the real file input reachable by the label text', () => {
    renderVi(<PhotoPicker label={LABEL} accept="image/*" file={null} onChange={() => {}} />);
    const input = screen.getByLabelText(LABEL) as HTMLInputElement;
    expect(input.type).toBe('file');
    expect(input.accept).toBe('image/*');
  });

  it('reports the picked file and shows its name with a remove button', () => {
    const onChange = vi.fn();
    const file = new File(['x'], 'kiln.jpg', { type: 'image/jpeg' });
    renderVi(<Harness onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(LABEL), { target: { files: [file] } });
    expect(onChange).toHaveBeenCalledWith(file);
    expect(screen.getByText('kiln.jpg')).toBeTruthy();
    expect(screen.queryByText('Chưa chọn ảnh')).toBeNull();
    expect(screen.getByRole('button', { name: 'Bỏ chọn' })).toBeTruthy();
  });

  it('clears the file when remove is clicked', () => {
    const onChange = vi.fn();
    const file = new File(['x'], 'kiln.jpg', { type: 'image/jpeg' });
    renderVi(<PhotoPicker label={LABEL} accept="image/*" file={file} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Bỏ chọn' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
