/** Price units the admin form and the demo seed store in Vietnamese, mapped to the keys of `news.materialPrices.units`. */
const KNOWN_UNITS = {
  tấn: 'tonne',
  kg: 'kg',
  'bình 12 kg': 'cylinder12kg',
} as const;

export type MaterialUnitKey = (typeof KNOWN_UNITS)[keyof typeof KNOWN_UNITS];

/** The message key of a stored unit string, or `null` when it is not one of the known Vietnamese units. */
export function materialUnitKey(unit: string): MaterialUnitKey | null {
  const normalized = unit.trim().toLowerCase().replace(/\s+/g, ' ');
  return Object.hasOwn(KNOWN_UNITS, normalized)
    ? KNOWN_UNITS[normalized as keyof typeof KNOWN_UNITS]
    : null;
}

/** A stored unit translated for display; an unknown unit is shown unchanged. Stored data is not changed. */
export function materialUnitLabel(
  unit: string,
  translate: (key: MaterialUnitKey) => string,
): string {
  const key = materialUnitKey(unit);
  return key ? translate(key) : unit;
}
