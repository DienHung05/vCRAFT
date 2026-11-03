import { describe, expect, it } from 'vitest';
import { sessionFacts } from './identity-verifier';

describe('sessionFacts (GH#83)', () => {
  it('reads the assurance level, session id and sign-in method from Supabase claims', () => {
    expect(
      sessionFacts({
        aal: 'aal2',
        session_id: '9d1f3c2a-0000-4000-8000-000000000001',
        amr: [
          { method: 'totp', timestamp: 2 },
          { method: 'password', timestamp: 1 },
        ],
      }),
    ).toEqual({
      aal: 'aal2',
      sessionId: '9d1f3c2a-0000-4000-8000-000000000001',
      method: 'password',
    });
  });

  it('ignores missing or malformed claims', () => {
    expect(sessionFacts(null)).toEqual({});
    expect(sessionFacts({ aal: 'aal9', session_id: 42, amr: 'password' })).toEqual({});
  });
});
