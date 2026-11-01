import { fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ConsentCheckbox } from '@/components/consent-checkbox';
import { renderEn, renderVi } from './render';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

function Controlled({ error }: { error?: string }) {
  const [checked, setChecked] = useState(false);
  return (
    <ConsentCheckbox
      id="c"
      purpose="quote"
      checked={checked}
      onChange={(event) => setChecked(event.target.checked)}
      error={error}
    />
  );
}

describe('ConsentCheckbox', () => {
  it('links the privacy policy in a new tab and names what the consent covers', () => {
    renderVi(<Controlled />);
    const link = screen.getByRole('link', { name: 'Chính sách quyền riêng tư' });
    expect(link.getAttribute('href')).toBe('/chinh-sach-quyen-rieng-tu');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noreferrer');
    const box = screen.getByRole('checkbox', { name: /địa chỉ nhận hàng/ });
    expect((box as HTMLInputElement).checked).toBe(false);
    fireEvent.click(box);
    expect((box as HTMLInputElement).checked).toBe(true);
  });

  it('is written in English on the English site', () => {
    renderEn(<Controlled />);
    expect(screen.getByRole('link', { name: 'Privacy policy' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: /I have read the Privacy policy/ })).toBeTruthy();
  });

  it('shows the error as an alert tied to the box', () => {
    renderVi(<Controlled error="Hãy đồng ý." />);
    const box = screen.getByRole('checkbox');
    expect(box.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('alert').textContent).toBe('Hãy đồng ý.');
    expect(box.getAttribute('aria-describedby')).toBe(screen.getByRole('alert').id);
  });
});
