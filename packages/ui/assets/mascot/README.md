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

## Usage

Both sheets are served from `apps/web/public/mascots/` and consumed by
`packages/ui/src/mascot/mascot.tsx`. The component renders two stacked `<span>` layers
with `background-size: 300% 300%` and positions each cell using 0/50/100% steps.
Do not recolour or restyle the sheets to fit the site brand.
