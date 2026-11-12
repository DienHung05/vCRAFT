import type { GLAZES, PRODUCT_TEMPLATES } from './pools.js';

/**
 * English text of the demo products (GH#482). The Vietnamese names are built from a template and a glaze
 * (`${template} ${glaze}`), so the English ones come from the same two pools: every generated product, published
 * or draft, gets an English name, description and material, with no machine translation and no claim the
 * Vietnamese text does not make. Pure and deterministic; it never draws from the seed's `random`, so the frozen
 * trace codes do not change.
 */

/** English noun phrase of each product template; the type forces a translation for every template. */
export const TEMPLATE_EN: Record<(typeof PRODUCT_TEMPLATES)[number], string> = {
  'Bình hút lộc': 'Fortune Vase',
  'Bát chiết yêu': 'Waisted Bowl',
  'Cốc quai': 'Handled Cup',
  'Bộ ấm chén': 'Teapot and Cup Set',
  'Đĩa tròn': 'Round Plate',
  'Lọ hoa miệng loe': 'Flared-Mouth Flower Vase',
  'Âu đựng canh': 'Soup Serving Bowl',
  'Tách trà': 'Tea Cup',
  'Lục bình': 'Lục Bình Tall Vase',
  'Chậu cây mini': 'Mini Plant Pot',
  'Ống đựng bút': 'Pen Holder',
  'Bình ngâm rượu': 'Wine-Steeping Jar',
  'Đĩa trà': 'Tea Dish',
  'Hũ đựng trà': 'Tea Caddy',
  'Bình đựng nước': 'Water Jug',
  'Bát ăn cơm': 'Rice Bowl',
  'Chén tống': 'Tea Pitcher',
  'Lư hương': 'Incense Burner',
  'Tô sứ': 'Large Porcelain Bowl',
  'Khay trà': 'Tea Tray',
};

/** English of each glaze: `adjective` goes before the noun in a name, `noun` after "clay," in the material. */
export const GLAZE_EN: Record<(typeof GLAZES)[number], { adjective: string; noun: string }> = {
  'men lam': { adjective: 'Blue-Glazed', noun: 'blue glaze' },
  'men rạn': { adjective: 'Crackle-Glazed', noun: 'crackle glaze' },
  'men ngọc': { adjective: 'Jade-Glazed', noun: 'jade glaze' },
  'men nâu': { adjective: 'Brown-Glazed', noun: 'brown glaze' },
  'men trắng ngà': { adjective: 'Ivory-Glazed', noun: 'ivory-white glaze' },
  'vẽ sen': { adjective: 'Lotus-Painted', noun: 'hand-painted lotus' },
  'vẽ lam': { adjective: 'Blue-Painted', noun: 'hand-painted blue' },
  'men hoa nâu': { adjective: 'Brown-Floral-Glazed', noun: 'brown floral glaze' },
};

export interface ProductEnglish {
  nameEn: string;
  descriptionEn: string;
  materialEn: string;
  /** Null when the Vietnamese product has no dimensions. */
  dimensionsEn: string | null;
}

/** English description: the Vietnamese one ("{name} do hộ {household} làm thủ công tại Bát Tràng.") says no more. */
export function descriptionEn(nameEn: string, householdName: string): string {
  return `${nameEn}, handmade by the ${householdName} household in Bát Tràng.`;
}

/** English name, description and material of a generated product (template × glaze) of `householdName`. */
export function generatedProductEnglish(
  template: (typeof PRODUCT_TEMPLATES)[number],
  glaze: (typeof GLAZES)[number],
  householdName: string,
): ProductEnglish {
  const nameEn = `${GLAZE_EN[glaze].adjective} ${TEMPLATE_EN[template]}`;
  return {
    nameEn,
    descriptionEn: descriptionEn(nameEn, householdName),
    materialEn: `Bát Tràng clay, ${GLAZE_EN[glaze].noun}`,
    dimensionsEn: null,
  };
}

/** English of the fixed products (those with a licensed photo), keyed by trace-code-independent Vietnamese name. */
export const FIXED_PRODUCT_EN: Record<
  string,
  { nameEn: string; materialEn: string; dimensionsEn: string }
> = {
  'Bình hút lộc men lam': {
    nameEn: 'Blue-Glazed Fortune Vase',
    materialEn: 'White Trúc Thôn clay, ash-grey blue glaze',
    dimensionsEn: 'Height 32 cm · Mouth 9 cm · Belly 22 cm',
  },
  'Bát vẽ sen men trong': {
    nameEn: 'Lotus-Painted Bowl with Clear Glaze',
    materialEn: 'White clay, clear glaze',
    dimensionsEn: 'Diameter 16 cm',
  },
  'Cốc men trắng quai tròn': {
    nameEn: 'White-Glazed Cup with Round Handle',
    materialEn: 'Clay, white glaze',
    dimensionsEn: '330 ml',
  },
};

/** English of a fixed product by its Vietnamese name; undefined for a name that is not fixed. */
export function fixedProductEnglish(
  name: string,
  householdName: string,
): ProductEnglish | undefined {
  const fixed = FIXED_PRODUCT_EN[name];
  return fixed && { ...fixed, descriptionEn: descriptionEn(fixed.nameEn, householdName) };
}
