# Fox mascot sources

`fox-moods.svg` is the reference sheet of the nine moods (idle, greet, listen, think, talk, happy, confused,
refuse, sleep) in the light palette, rendered from `packages/ui/src/mascot/mascot.tsx` with motion off.
The component draws the Fox as vector shapes on brand tokens, so it follows the light and dark themes;
regenerate this sheet after changing the drawing. BRAND §10 allowed SVG or two WebP sprite sheets; SVG
keeps it sharp at 56, 64 and 96 px and lets the head turn and blink without extra frames.
