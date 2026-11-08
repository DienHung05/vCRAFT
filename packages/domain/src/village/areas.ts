/**
 * Village areas used to target power-outage notices (GH#294, ADR-0023). The codes are stable identifiers
 * stored on workshops and in news data; the display names live in the i18n messages.
 */

/** The hamlets a workshop can belong to. The column is a plain string, so a new hamlet needs only a code here and a message. */
export const VILLAGE_AREA_CODES = ['BAT_TRANG', 'GIANG_CAO'] as const;
export type VillageAreaCode = (typeof VILLAGE_AREA_CODES)[number];

/** A notice for every household, whatever the area of its workshops. */
export const VILLAGE_WIDE = 'VILLAGE_WIDE' as const;

/** The audiences of an outage notice: one hamlet, or the whole commune. */
export const OUTAGE_AREA_CODES = [...VILLAGE_AREA_CODES, VILLAGE_WIDE] as const;
export type OutageAreaCode = (typeof OUTAGE_AREA_CODES)[number];

export const isVillageAreaCode = (value: unknown): value is VillageAreaCode =>
  typeof value === 'string' && (VILLAGE_AREA_CODES as readonly string[]).includes(value);
