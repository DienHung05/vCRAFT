#!/usr/bin/env bash
# Builds the offline fallback for the village map (GH#100, PLAN E8/S7): a PMTiles extract of the Bát Tràng
# area from the daily Protomaps planet build, then uploads it to the public Supabase Storage bucket.
#
# Needs the `pmtiles` CLI (https://github.com/protomaps/go-pmtiles/releases) on PATH, plus SUPABASE_URL and
# SUPABASE_SECRET_KEY for the upload. Run it from the repository root:
#   scripts/map/extract-bat-trang.sh                # extract, then upload
#   SKIP_UPLOAD=1 scripts/map/extract-bat-trang.sh  # extract only
# Then set NEXT_PUBLIC_MAP_PMTILES_URL to the printed URL on Vercel and redeploy (docs/operations/deploy.md §5.1).
set -euo pipefail

# Bát Tràng and the river bank around it (west,south,east,north); zoom 16 keeps the file around a few MB.
BBOX="${BBOX:-105.895,20.955,105.935,20.995}"
MAXZOOM="${MAXZOOM:-16}"
BUCKET="${BUCKET:-public}"
OBJECT="${OBJECT:-map/bat-trang.pmtiles}"
OUT="${OUT:-bat-trang.pmtiles}"
# A recent daily build; override with SOURCE=https://build.protomaps.com/<yyyymmdd>.pmtiles if this one is gone.
SOURCE="${SOURCE:-https://build.protomaps.com/$(date -u -d 'yesterday' +%Y%m%d 2>/dev/null || date -u -v-1d +%Y%m%d).pmtiles}"

command -v pmtiles >/dev/null || { echo "pmtiles CLI not found: install go-pmtiles first" >&2; exit 1; }

echo "Extracting $BBOX (z0-$MAXZOOM) from $SOURCE"
pmtiles extract "$SOURCE" "$OUT" --bbox="$BBOX" --maxzoom="$MAXZOOM"
pmtiles show "$OUT" | head -20

if [ "${SKIP_UPLOAD:-}" = 1 ]; then
  echo "Skipped upload; file at $OUT"
  exit 0
fi

: "${SUPABASE_URL:?SUPABASE_URL is required for the upload}"
: "${SUPABASE_SECRET_KEY:?SUPABASE_SECRET_KEY is required for the upload}"
curl -fsS -X POST "$SUPABASE_URL/storage/v1/object/$BUCKET/$OBJECT" \
  -H "Authorization: Bearer $SUPABASE_SECRET_KEY" \
  -H "apikey: $SUPABASE_SECRET_KEY" \
  -H "x-upsert: true" \
  -H "Content-Type: application/vnd.pmtiles" \
  -H "Cache-Control: max-age=604800" \
  --data-binary "@$OUT" >/dev/null
echo "Uploaded. NEXT_PUBLIC_MAP_PMTILES_URL=$SUPABASE_URL/storage/v1/object/public/$BUCKET/$OBJECT"
