# Fox mascot sources

These are the original, unmodified sprite sheets from the **page-mascot** skill,
character `fox`. Source: https://koboyo.com/page-mascot/mascots/

## fox-directions.webp

1080×1080 WebP with alpha transparency. 3×3 grid of 360×360 px cells, row-major:

| col 0     | col 1 | col 2      |
|-----------|-------|------------|
| up-left   | up    | up-right   |
| left      | center| right      |
| down-left | down  | down-right |

## fox-reactions.webp

1080×1080 WebP with alpha transparency. 3×3 grid of 360×360 px cells, row-major:

| col 0                        | col 1 | col 2                     |
|------------------------------|-------|---------------------------|
| blink (eyes closed, smiling) | heart | sparkle                   |
| surprised (open "o" mouth)   | star-eyes | bashful (blush)       |
| sleepy (Zz)                  | dizzy (spiral eyes) | delighted (open smile) |

## fox-directions-blink.webp

Derived, not original (GH#186). 1080×1080 WebP with alpha, same 3×3 grid, cell order and pixel
alignment as `fox-directions.webp`: each cell is the matching directions cell with only the eyes
closed. Alpha is identical to `fox-directions.webp`, so the head, ears and outline do not move.
Built by `scripts/mascot/make-blink-sheet.py` from `fox-directions.webp`; regenerate it with that
script if the directions sheet ever changes.

## Usage

All three sheets are served from `apps/web/public/mascots/` and consumed by
`packages/ui/src/mascot/mascot.tsx`. The component renders three stacked `<span>` layers
with `background-size: 300% 300%` and positions each cell using 0/50/100% steps. A blink
shows the blink layer on the same cell as the directions layer, with no transition.
Do not recolour or restyle the sheets to fit the site brand.
