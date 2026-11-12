import { describe, expect, it } from 'vitest';
import { DEMO_HOUSEHOLD_COUNT } from '../src/seeders/demo/seed-demo';
import {
  checkNoStrayApprovedHouseholds,
  demoHouseholdIdSet,
  strayApprovedHouseholds,
} from '../src/seeders/demo/verify-stray-households';

describe('demo:verify stray approved households (GH#474)', () => {
  it('knows every seed household id exactly once', () => {
    expect(demoHouseholdIdSet().size).toBe(DEMO_HOUSEHOLD_COUNT);
  });

  it('finds nothing when every approved household is in the seed', () => {
    const approved = [...demoHouseholdIdSet()].map((id) => ({ id, slug: id }));
    expect(strayApprovedHouseholds(approved)).toEqual([]);
  });

  it('reports an approved household that is not in the seed', () => {
    const [first] = [...demoHouseholdIdSet()];
    const approved = [
      { id: first as string, slug: 'gom-trong-seed' },
      { id: '01a1bb58-882c-74df-9d12-ff5b3b1641b3', slug: 'hu-tieu-a-tam' },
    ];
    expect(strayApprovedHouseholds(approved)).toEqual([
      { id: '01a1bb58-882c-74df-9d12-ff5b3b1641b3', slug: 'hu-tieu-a-tam' },
    ]);
  });

  it('turns the result into a failing check naming the stray slug', async () => {
    const em = {
      find: async () => [{ id: '01a1bb58-882c-74df-9d12-ff5b3b1641b3', slug: 'hu-tieu-a-tam' }],
    };
    const check = await checkNoStrayApprovedHouseholds(em as never);
    expect(check.ok).toBe(false);
    expect(check.detail).toContain('hu-tieu-a-tam');
  });

  it('passes when the database holds only seed households', async () => {
    const em = { find: async () => [...demoHouseholdIdSet()].map((id) => ({ id, slug: id })) };
    expect((await checkNoStrayApprovedHouseholds(em as never)).ok).toBe(true);
  });
});
