import { AUDIT_ACTIONS } from '@vcraft/contracts';
import { messages } from '@vcraft/i18n';
import { describe, expect, it } from 'vitest';

/** Reads `admin.audit.actions.<a>.<b>` from a locale's messages; undefined when any level is missing. */
function label(locale: 'vi' | 'en', action: string): unknown {
  let node: unknown = messages[locale].admin.audit.actions;
  for (const part of action.split('.')) {
    node = node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined;
  }
  return node;
}

describe('audit log action labels (GH#394)', () => {
  it.each(['vi', 'en'] as const)('every audit action has a %s label', (locale) => {
    const missing = AUDIT_ACTIONS.filter((action) => typeof label(locale, action) !== 'string');
    expect(missing).toEqual([]);
  });
});
