import { PROFILES, type Profile } from './vase-profiles';

/** Matches the 3D scene: camera at z=5.4 with a 30 degree field of view shows 2.89 units over the box height. */
export const VIEW = { width: 400, height: 500 } as const;
const UNIT = VIEW.height / (2 * 5.4 * Math.tan((15 * Math.PI) / 180));
const CENTRE_X = VIEW.width / 2;
/** The 3D lathe sits at heights -1 to 1, with the camera a little above the middle. */
const FOOT_Y = VIEW.height / 2 + UNIT * 0.9;

/** The finished vase the 3D story ends on: the money jar. */
export const HERO_PROFILE: Profile = PROFILES[PROFILES.length - 1] as Profile;

export interface SilhouetteGeometry {
  /** Closed outline of the vase in viewBox units. */
  path: string;
  /** Per-height slices, so each ring can be shaded across its own width. */
  rings: readonly { y0: number; y1: number; r0: number; r1: number }[];
  centreX: number;
  footY: number;
  topY: number;
  lipRadius: number;
}

type Point = readonly [number, number];

const f = (n: number) => n.toFixed(2);

/** Quadratic smoothing through the midpoints of the sampled points. */
function smooth(line: readonly Point[]): string {
  let d = '';
  for (let i = 1; i < line.length - 1; i++) {
    const [x, y] = line[i] as Point;
    const [nx, ny] = line[i + 1] as Point;
    d += ` Q${f(x)} ${f(y)} ${f((x + nx) / 2)} ${f((y + ny) / 2)}`;
  }
  const [lx, ly] = line[line.length - 1] as Point;
  return `${d} L${f(lx)} ${f(ly)}`;
}

/** Derives the outline from the same profile the WebGL lathe uses, so the shape matches. */
export function silhouette(profile: Profile = HERO_PROFILE): SilhouetteGeometry {
  const pts = profile.map(([r, h]) => ({ x: r * UNIT, y: FOOT_Y - h * UNIT }));
  const right = pts.map((p): Point => [CENTRE_X + p.x, p.y]);
  const left = pts.map((p): Point => [CENTRE_X - p.x, p.y]).reverse();
  const [startX, startY] = right[0] as Point;
  const [leftX, leftY] = left[0] as Point;
  const path = `M${f(startX)} ${f(startY)}${smooth(right)} L${f(leftX)} ${f(leftY)}${smooth(left)} Z`;
  const rings = profile.slice(1).map(([r1, h1], i) => {
    const [r0, h0] = profile[i] as readonly [number, number];
    return { y0: FOOT_Y - h0 * UNIT, y1: FOOT_Y - h1 * UNIT, r0: r0 * UNIT, r1: r1 * UNIT };
  });
  const last = pts[pts.length - 1] as { x: number; y: number };
  return { path, rings, centreX: CENTRE_X, footY: FOOT_Y, topY: last.y, lipRadius: last.x };
}
