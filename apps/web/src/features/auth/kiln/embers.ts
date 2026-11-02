/**
 * Static ember field of the kiln scene: three layers of dots, [x %, y %, radius px, opacity, colour slot].
 * Positions are percentages of the scene, so one list serves every viewport. Generated once from a seeded
 * RNG (denser near the bottom, where the kiln glows); not meant to be edited by hand.
 */
export type Ember = readonly [x: number, y: number, r: number, opacity: number, colour: number];

/** Small sharp sparks, the slowest drift. */
export const EMBERS_FAR: readonly Ember[] = [
  [45.3, 59.3, 2.2, 0.58, 3],
  [84.8, 92.4, 1.8, 0.59, 3],
  [78.7, 97.4, 0.9, 0.4, 4],
  [63.2, 55.2, 1.1, 0.58, 4],
  [61.3, 94.3, 0.8, 0.61, 0],
  [4.5, 18, 1.4, 0.74, 2],
  [44.2, 23.3, 1.2, 0.67, 3],
  [1.5, 97.8, 1.5, 0.55, 3],
  [98.6, 23.7, 1.6, 0.51, 1],
  [51.3, 99.6, 1.3, 0.4, 0],
  [84, 77.1, 2.3, 0.77, 0],
  [21.9, 11.1, 0.8, 0.54, 4],
  [39.9, 98.3, 1.4, 0.74, 2],
  [34, 83.6, 0.8, 0.56, 0],
  [14.2, 41.6, 0.8, 0.58, 3],
  [18.4, 59.4, 1.1, 0.45, 4],
  [76.4, 74, 1, 0.55, 1],
  [1, 20.2, 2.3, 0.65, 0],
  [21.6, 76.4, 2, 0.67, 0],
  [5.1, 94.9, 1.1, 0.35, 3],
];
/** Soft glowing embers (radial gradient fill). */
export const EMBERS_MID: readonly Ember[] = [
  [33.2, 80.6, 3.6, 0.4, 0],
  [2.5, 74, 5.3, 0.41, 1],
  [82.6, 93.3, 4.4, 0.66, 1],
  [90, 23.8, 4, 0.44, 0],
  [68.3, 72.1, 4.8, 0.39, 0],
  [11.2, 98.8, 6.8, 0.47, 1],
  [26.2, 23, 5.2, 0.5, 0],
  [92.1, 3.1, 3.7, 0.59, 0],
  [28.5, 11, 3.9, 0.36, 1],
  [41.3, 84.7, 3.5, 0.49, 0],
  [10, 93.1, 4.6, 0.52, 0],
  [58.8, 10.2, 4.7, 0.53, 1],
];
/** Brighter sparks in front, the quickest drift. */
export const EMBERS_NEAR: readonly Ember[] = [
  [95.4, 99.9, 2.5, 0.78, 2],
  [32.3, 0.1, 1.6, 0.81, 0],
  [89.2, 40.5, 2.6, 0.9, 2],
  [35.5, 47.4, 3.1, 0.93, 3],
  [93.5, 99.7, 2.2, 0.61, 3],
  [38.2, 99.9, 1.6, 0.63, 0],
  [98.3, 19.6, 2.7, 0.75, 3],
  [44.2, 25.9, 1.6, 0.89, 0],
];
