import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const template = (name: string) =>
  readFileSync(resolve(__dirname, '../../../supabase/templates', name), 'utf8');

describe('auth email templates keep the user locale (GH#432)', () => {
  it.each([
    ['recovery.html', 'dat-lai-mat-khau', 'reset-password'],
    ['invite.html', 'chap-nhan-loi-moi', 'accept-invitation'],
  ])('%s picks the locale prefix and path from .Data.locale', (file, vi, en) => {
    const html = template(file);
    expect(html).not.toMatch(new RegExp(`/vi/${vi}?token_hash`));
    expect(html).toContain('{{ if .Data.locale }}{{ if eq .Data.locale "en" }}');
    expect(html).toContain(`en/${en}`);
    // Without a locale in the user metadata the link falls back to Vietnamese.
    expect(html).toContain(`{{ else }}vi/${vi}{{ end }}?token_hash`);
  });
});
