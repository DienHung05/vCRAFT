import type { StyleSpecification } from 'maplibre-gl';

/**
 * Offline fallback for the village map (PLAN E8, S7, GH#100): when OpenFreeMap is unreachable the map
 * switches to a PMTiles extract of Bát Tràng kept in our own storage, drawn with a small brand style.
 * The extract uses the Protomaps basemap schema (layers `earth`, `water`, `landuse`, `roads`,
 * `buildings`, `places`), built by `scripts/map/extract-bat-trang.sh`.
 */

export const ONLINE_STYLE_URL =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/liberty';

/** Public URL of the Bát Tràng `.pmtiles` extract; empty means there is no fallback. */
export const PMTILES_URL = process.env.NEXT_PUBLIC_MAP_PMTILES_URL?.trim() ?? '';

/** Glyphs for labels; if they cannot load either, MapLibre simply draws no text. */
const GLYPHS_URL =
  process.env.NEXT_PUBLIC_MAP_GLYPHS_URL ||
  'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf';

/** How long the online style may take to answer before the map gives up on it. */
export const STYLE_PROBE_TIMEOUT_MS = 2_500;

// BRAND §3.1 "Giấy dó": paper ground, clay roads, glaze water, ink labels.
const BRAND = {
  paper: '#f5efe4',
  surface: '#fbf8f2',
  ink: '#1c1814',
  ash: '#6b635a',
  clay: '#a8482a',
  glaze: '#1e3a6e',
  celadon: '#5e8a7d',
} as const;

/** The brand style over the PMTiles extract; text uses `Noto Sans Regular`, as the pin layers do. */
export function offlineStyle(pmtilesUrl: string): StyleSpecification {
  const source = 'bat-trang';
  return {
    version: 8,
    glyphs: GLYPHS_URL,
    sources: {
      [source]: {
        type: 'vector',
        url: `pmtiles://${pmtilesUrl}`,
        attribution: '© OpenStreetMap contributors, Protomaps',
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': BRAND.paper } },
      {
        id: 'earth',
        type: 'fill',
        source,
        'source-layer': 'earth',
        paint: { 'fill-color': BRAND.surface },
      },
      {
        id: 'landuse-green',
        type: 'fill',
        source,
        'source-layer': 'landuse',
        filter: [
          'in',
          ['get', 'kind'],
          ['literal', ['park', 'grass', 'farmland', 'forest', 'wood']],
        ],
        paint: { 'fill-color': BRAND.celadon, 'fill-opacity': 0.18 },
      },
      {
        id: 'water',
        type: 'fill',
        source,
        'source-layer': 'water',
        paint: { 'fill-color': BRAND.glaze, 'fill-opacity': 0.35 },
      },
      {
        id: 'buildings',
        type: 'fill',
        source,
        'source-layer': 'buildings',
        minzoom: 14,
        paint: { 'fill-color': BRAND.ash, 'fill-opacity': 0.14 },
      },
      {
        id: 'roads-minor',
        type: 'line',
        source,
        'source-layer': 'roads',
        filter: ['in', ['get', 'kind'], ['literal', ['minor_road', 'path', 'other']]],
        paint: {
          'line-color': BRAND.clay,
          'line-opacity': 0.35,
          'line-width': ['interpolate', ['linear'], ['zoom'], 13, 0.5, 18, 4],
        },
      },
      {
        id: 'roads-major',
        type: 'line',
        source,
        'source-layer': 'roads',
        filter: ['in', ['get', 'kind'], ['literal', ['highway', 'major_road', 'medium_road']]],
        paint: {
          'line-color': BRAND.clay,
          'line-opacity': 0.7,
          'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1, 18, 8],
        },
      },
      {
        id: 'road-labels',
        type: 'symbol',
        source,
        'source-layer': 'roads',
        minzoom: 15,
        layout: {
          'symbol-placement': 'line',
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 11,
        },
        paint: { 'text-color': BRAND.ash, 'text-halo-color': BRAND.paper, 'text-halo-width': 1.5 },
      },
      {
        id: 'place-labels',
        type: 'symbol',
        source,
        'source-layer': 'places',
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 12, 12, 16, 16],
        },
        paint: { 'text-color': BRAND.ink, 'text-halo-color': BRAND.paper, 'text-halo-width': 2 },
      },
    ],
  };
}

/** Whether the online style answers in time; any network error, HTTP error or timeout is a no. */
export async function isReachable(
  url: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = STYLE_PROBE_TIMEOUT_MS,
): Promise<boolean> {
  try {
    const res = await fetchImpl(url, {
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * The style the map should load: the online one when it answers, otherwise the PMTiles fallback if
 * one is configured, otherwise the online one anyway (MapLibre then shows its own error state).
 */
export async function chooseMapStyle(options: {
  onlineUrl?: string;
  pmtilesUrl?: string;
  fetchImpl?: typeof fetch;
}): Promise<{ style: string | StyleSpecification; offline: boolean }> {
  const onlineUrl = options.onlineUrl ?? ONLINE_STYLE_URL;
  const pmtilesUrl = options.pmtilesUrl ?? PMTILES_URL;
  if (!pmtilesUrl) return { style: onlineUrl, offline: false };
  if (await isReachable(onlineUrl, options.fetchImpl)) return { style: onlineUrl, offline: false };
  return { style: offlineStyle(pmtilesUrl), offline: true };
}

/** A map error that means the online tiles or style stopped loading, so the fallback should take over. */
export function isTileServerError(error: unknown, onlineUrl = ONLINE_STYLE_URL): boolean {
  const host = /^https?:\/\/([^/]+)/.exec(onlineUrl)?.[1];
  const message = String((error as { message?: unknown } | null)?.message ?? error ?? '');
  const url = String((error as { url?: unknown } | null)?.url ?? '');
  return Boolean(host) && (message.includes(host as string) || url.includes(host as string));
}
