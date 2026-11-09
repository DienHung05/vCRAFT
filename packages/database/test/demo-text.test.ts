import { describe, expect, it } from 'vitest';
import { artisanBio, householdStory } from '../src/seeders/demo/demo-text';
import { HOUSEHOLDS, PENDING_HOUSEHOLD } from '../src/seeders/demo/pools';
import { stripDemoDisclaimer } from '../src/seeders/demo/refresh-text';

/** Words the demo text must never contain (GH#204, GH#298): it reads as true, never as sample data. */
const FORBIDDEN = /mẫu|hư cấu|trình diễn|demo|không phải hộ thật|dữ liệu mẫu/i;
const ALL_SEEDS = [...HOUSEHOLDS, PENDING_HOUSEHOLD];
const words = (text: string) => text.trim().split(/\s+/).length;
const ROLES = [
  'Chủ hộ, thợ cả',
  'Thợ vuốt dáng',
  'Thợ vẽ lam',
  'Thợ tráng men',
  'Thợ nung lò',
  'Thợ hoàn thiện',
];

describe('householdStory', () => {
  const seed = HOUSEHOLDS[0] as (typeof HOUSEHOLDS)[number];

  it('fills the address and drops the trailing ", Hà Nội"', () => {
    const story = householdStory(seed, 'Xóm 3, Bát Tràng, Gia Lâm, Hà Nội');
    expect(story).toContain('Xóm 3, Bát Tràng, Gia Lâm');
    expect(story).not.toContain('Hà Nội');
    expect(story).not.toContain('{address}');
  });
});

describe('household stories in the seed', () => {
  it('covers the 20 approved households and the pending one', () => {
    expect(ALL_SEEDS).toHaveLength(21);
  });

  it.each(ALL_SEEDS.map((seed) => [seed.name, seed] as const))(
    '%s: one {address}, 90 to 150 words, no sample-data wording',
    (_name, seed) => {
      expect(seed.story.split('{address}')).toHaveLength(2);
      const count = words(seed.story);
      expect(count).toBeGreaterThanOrEqual(90);
      expect(count).toBeLessThanOrEqual(150);
      expect(seed.story).not.toMatch(FORBIDDEN);
    },
  );

  it('are all distinct, including the opening words', () => {
    expect(new Set(ALL_SEEDS.map((seed) => seed.story)).size).toBe(21);
    const openings = new Set(
      ALL_SEEDS.map((seed) => seed.story.split(/\s+/).slice(0, 3).join(' ')),
    );
    expect(openings.size).toBeGreaterThanOrEqual(18);
  });
});

describe('artisanBio', () => {
  const household = HOUSEHOLDS[3] as (typeof HOUSEHOLDS)[number];

  it('is deterministic', () => {
    const input = { household, artisanName: 'Vũ Thanh Hà', position: 1, craftRole: 'Thợ vẽ lam' };
    expect(artisanBio(input)).toBe(artisanBio({ ...input }));
  });

  it('never leaves a placeholder or sample-data wording, for every seed and role', () => {
    const names = ['Nguyễn Minh', 'Trần Lan', 'Lê Hùng', 'Phạm Thảo', 'Đỗ Quân', 'Bùi Cúc'];
    for (const seed of ALL_SEEDS) {
      for (const [position, role] of ROLES.entries()) {
        for (const artisanName of names) {
          const bio = artisanBio({ household: seed, artisanName, position, craftRole: role });
          expect(bio).not.toMatch(FORBIDDEN);
          expect(bio).not.toMatch(/[{}]/);
          expect(bio).toContain(seed.name);
          expect(bio).toContain(artisanName.split(' ').at(-1) as string);
          expect(bio).not.toMatch(/người chủ hộ|người thợ/i);
          expect(words(bio)).toBeGreaterThanOrEqual(35);
          expect(words(bio)).toBeLessThanOrEqual(80);
        }
      }
    }
  });

  it('gives the owner and a worker different text, and names the worker step', () => {
    const owner = artisanBio({
      household,
      artisanName: household.owner,
      position: 0,
      craftRole: 'Chủ hộ, thợ cả',
    });
    const worker = artisanBio({
      household,
      artisanName: 'Vũ Thanh Hà',
      position: 1,
      craftRole: 'Thợ tráng men',
    });
    expect(owner).not.toBe(worker);
    expect(owner).toContain(household.craft);
    expect(worker).toContain('tráng men');
  });

  it('varies across artisans of one household', () => {
    const bios = new Set(
      ['An', 'Bình', 'Chi', 'Dũng', 'Em', 'Giang', 'Hà', 'Khoa'].map((artisanName) =>
        artisanBio({ household, artisanName, position: 1, craftRole: 'Thợ nung lò' }),
      ),
    );
    expect(bios.size).toBeGreaterThanOrEqual(4);
  });

  it('refers to the artisan by given name, once or twice', () => {
    const owner = artisanBio({
      household: HOUSEHOLDS[8] as (typeof HOUSEHOLDS)[number],
      artisanName: 'Phan Đại Phong',
      position: 0,
      craftRole: 'Chủ hộ, thợ cả',
    });
    const mentions = (text: string) => text.split('Phong').length - 1;
    expect(mentions(owner)).toBeGreaterThanOrEqual(1);
    expect(mentions(owner)).toBeLessThanOrEqual(3);
    expect(owner).not.toContain('Phan Đại');
  });

  it('keeps the owner templates generic about family', () => {
    for (const seed of ALL_SEEDS) {
      for (const artisanName of ['An', 'Bình', 'Chi', 'Dũng', 'Em', 'Giang', 'Hà', 'Khoa']) {
        const bio = artisanBio({
          household: seed,
          artisanName,
          position: 0,
          craftRole: 'Chủ hộ, thợ cả',
        });
        expect(bio).not.toMatch(/cha ông|bốn đời|ba đời|năm đời|hai đời/i);
      }
    }
  });

  it('copes with a missing craft role', () => {
    const bio = artisanBio({ household, artisanName: 'Vũ Thanh Hà', position: 2, craftRole: '' });
    expect(bio).not.toMatch(/[{}]/);
    expect(bio.length).toBeGreaterThan(40);
  });
});

describe('stripDemoDisclaimer', () => {
  it('keeps only the non-disclaimer sentence of the live household story', () => {
    const live =
      '[Dữ liệu mẫu] Hộ Gốm Đại Phong do Phan Đại Phong đại diện, làm nghề gốm ở Bát Tràng, chuyên tượng và chậu cây. Đây là hồ sơ hư cấu dùng để trình diễn, không phải hộ thật.';
    expect(stripDemoDisclaimer(live)).toBe(
      'Hộ Gốm Đại Phong do Phan Đại Phong đại diện, làm nghề gốm ở Bát Tràng, chuyên tượng và chậu cây.',
    );
  });

  it('returns an empty string when nothing but a disclaimer is left', () => {
    expect(stripDemoDisclaimer('Đây là hồ sơ hư cấu dùng để trình diễn, không phải hộ thật.')).toBe(
      '',
    );
  });

  it('strips the tag from the live artisan bio and news body', () => {
    expect(stripDemoDisclaimer('[Dữ liệu mẫu] Làm gốm men lam tại Bát Tràng.')).toBe(
      'Làm gốm men lam tại Bát Tràng.',
    );
    expect(
      stripDemoDisclaimer(
        '[Dữ liệu mẫu] Giá tham khảo tại các đại lý trong làng, áp dụng từ đầu tháng.',
      ),
    ).toBe('Giá tham khảo tại các đại lý trong làng, áp dụng từ đầu tháng.');
  });

  it('accepts any case and spacing of the tag', () => {
    expect(stripDemoDisclaimer('  [ dữ  liệu MẪU ]   Xin chào.')).toBe('Xin chào.');
  });

  it('keeps paragraph breaks and clean text untouched', () => {
    const clean = 'Đoạn một.\n\nĐoạn hai, có số 1.280 độ.';
    expect(stripDemoDisclaimer(clean)).toBe(clean);
  });

  it('is idempotent', () => {
    const samples = [
      '[Dữ liệu mẫu] Làm gốm men lam tại Bát Tràng.',
      '[Dữ liệu mẫu] Hộ A, chuyên bát. Đây là hồ sơ hư cấu, không phải hộ thật.',
      'Đoạn một.\n\nMột câu dùng để trình diễn. Câu còn lại.',
    ];
    for (const sample of samples) {
      const once = stripDemoDisclaimer(sample);
      expect(stripDemoDisclaimer(once)).toBe(once);
    }
  });
});
