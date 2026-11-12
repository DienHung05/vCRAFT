import { describe, expect, it } from 'vitest';
import {
  descriptionEn,
  FIXED_PRODUCT_EN,
  fixedProductEnglish,
  GLAZE_EN,
  generatedProductEnglish,
  TEMPLATE_EN,
} from '../src/seeders/demo/english.js';
import { GLAZES, PRODUCT_TEMPLATES } from '../src/seeders/demo/pools.js';

const VIETNAMESE_LETTERS = /[ăâđêôơưàáạảãèéẹẻẽìíịỉĩòóọỏõùúụủũỳýỵỷỹ]/i;

describe('English text of the demo products (GH#482)', () => {
  it('translates every product template and glaze, with no Vietnamese-only leftovers', () => {
    expect(Object.keys(TEMPLATE_EN).sort()).toEqual([...PRODUCT_TEMPLATES].sort());
    expect(Object.keys(GLAZE_EN).sort()).toEqual([...GLAZES].sort());
    for (const text of Object.values(TEMPLATE_EN)) expect(text.trim()).not.toBe('');
    for (const { adjective, noun } of Object.values(GLAZE_EN)) {
      expect(adjective.trim()).not.toBe('');
      expect(noun.trim()).not.toBe('');
      expect(`${adjective}${noun}`).not.toMatch(VIETNAMESE_LETTERS);
    }
  });

  it('gives every template and glaze pair a name, description and material that differ from the Vietnamese', () => {
    const names = new Set<string>();
    for (const template of PRODUCT_TEMPLATES) {
      for (const glaze of GLAZES) {
        const en = generatedProductEnglish(template, glaze, 'Gốm Minh Hải');
        expect(en.nameEn).not.toBe(`${template} ${glaze}`);
        expect(en.descriptionEn).toContain(en.nameEn);
        expect(en.descriptionEn).toContain('Gốm Minh Hải');
        expect(en.materialEn).toMatch(/^Bát Tràng clay, /);
        expect(en.dimensionsEn).toBeNull();
        names.add(en.nameEn);
      }
    }
    // No two pairs collapse into the same English name.
    expect(names.size).toBe(PRODUCT_TEMPLATES.length * GLAZES.length);
  });

  it('translates the three fixed products and nothing else', () => {
    expect(Object.keys(FIXED_PRODUCT_EN)).toEqual([
      'Bình hút lộc men lam',
      'Bát vẽ sen men trong',
      'Cốc men trắng quai tròn',
    ]);
    const cup = fixedProductEnglish('Cốc men trắng quai tròn', 'Lò Đức Phát');
    expect(cup).toMatchObject({
      nameEn: 'White-Glazed Cup with Round Handle',
      dimensionsEn: '330 ml',
      descriptionEn: descriptionEn('White-Glazed Cup with Round Handle', 'Lò Đức Phát'),
    });
    expect(fixedProductEnglish('Đĩa tròn men lam', 'Lò Đức Phát')).toBeUndefined();
  });

  it('names the fixed blue vase like the generated one of the same template and glaze', () => {
    expect(FIXED_PRODUCT_EN['Bình hút lộc men lam']?.nameEn).toBe(
      generatedProductEnglish('Bình hút lộc', 'men lam', 'x').nameEn,
    );
  });
});
