---
name: vCraft
description: A small warm museum for one Vietnamese craft village, sealed with the maker's imprint.
colors:
  paper: "#f5efe4"
  surface: "#fbf8f2"
  ink: "#1c1814"
  ash: "#6b635a"
  clay: "#a8482a"
  glaze: "#1e3a6e"
  seal: "#c2261c"
  celadon: "#5e8a7d"
  lacquer: "#8c6a24"
typography:
  display:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "clamp(3.5rem, 2.5rem + 5vw, 7rem)"
    fontWeight: 600
    lineHeight: 1.02
    letterSpacing: "-0.02em"
  h1:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "clamp(2.5rem, 2.0714rem + 2.1429vw, 4rem)"
    fontWeight: 600
    lineHeight: 1.08
    letterSpacing: "-0.02em"
  h2:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "clamp(2rem, 1.7857rem + 1.0714vw, 2.75rem)"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  h3:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "clamp(1.5rem, 1.3929rem + 0.5357vw, 1.875rem)"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "clamp(1rem, 0.9821rem + 0.0893vw, 1.0625rem)"
    fontWeight: 400
    lineHeight: 1.65
  small:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.5
rounded:
  input: "4px"
  card: "12px"
  chip: "999px"
spacing:
  gutter: "clamp(1rem, 0.4286rem + 2.8571vw, 3rem)"
  section: "clamp(4rem, 2.2857rem + 8.5714vw, 10rem)"
  container-editorial: "90rem"
  container-prose: "42rem"
components:
  button-primary:
    backgroundColor: "{colors.clay}"
    textColor: "{colors.paper}"
    rounded: "{rounded.input}"
    padding: "0 20px"
    height: "44px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.input}"
    padding: "0 20px"
    height: "44px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.input}"
    padding: "0 12px"
    height: "44px"
  button-seal:
    backgroundColor: "{colors.seal}"
    textColor: "{colors.paper}"
    rounded: "{rounded.input}"
    padding: "0 20px"
    height: "44px"
---

# Design System: vCraft

## Overview

**Creative North Star: "The Warm Little Museum"**

vCraft looks like a small museum, not a store. Paper backgrounds carry grain, ink text stays quiet, and large soft serif headlines leave room for hands and clay. The interface steps back so workshop photos, artisan portraits, and kiln stories lead.

Density shifts by role. Public pages use an editorial rhythm with wide gutters and deep section spacing. Workshop and admin tools tighten up, keep paper surfaces, and keep motion to short state feedback. Vietnamese is the default voice throughout.

**Key Characteristics:**
- Paper first, never pure white
- Soft serif headlines paired with a Vietnamese-first sans body
- The seal mark and trace frame as the recurring signature
- Warm, restrained motion shaped by clay, kiln, and spread

## Colors

Paper and ink do most of the work. Fired clay marks the primary action, glaze blue carries headlines and contrast blocks, and seal red stays rare for authentication and commitment.

### Primary
- **Fired Clay** (#a8482a): Main action color. Primary buttons, links, active states, and progress already completed.
- **Glaze Blue** (#1e3a6e): Headlines h1 through h3, blue pattern bands, contrast blocks, and focus outlines.
- **Seal Red** (#c2261c): Authentication and decisive commitment only. Trace frames, seal marks, halted states, and confirm tones.

### Secondary
- **Celadon** (#5e8a7d): Open workshops and success, used at large sizes or as icon and badge fills.
- **Lacquer Gold** (#8c6a24): Certificates and artisan honors, used at 18px and above.

### Neutral
- **Dó Paper** (#f5efe4): Main page background.
- **Surface** (#fbf8f2): Cards, dialogs, and raised panels on paper.
- **Ink** (#1c1814): Main text.
- **Kiln Ash** (#6b635a): Secondary text and captions.

Night Kiln dark mode remaps the same roles: charcoal paper (#14110f), raised surface (#1f1a16), ember clay (#e2703a), bright glaze (#8fb0e6), light seal (#f06a55).

### Named Rules
**The Rare Seal Rule.** Seal red covers no more than 5 percent of a screen. Its scarcity gives weight to stamps, verification, and final acceptance.

## Typography

**Display Font:** Fraunces, with Georgia and serif fallback
**Body Font:** Be Vietnam Pro, with system-ui and sans-serif fallback
**Label/Mono Font:** JetBrains Mono, with ui-monospace and monospace fallback

**Character:** Soft serif headlines with high SOFT axis carry warmth and craft. The sans body stays plain and legible for Vietnamese diacritics. Mono marks trace codes, RFQ codes, and hashes as technical facts.

### Hierarchy
- **Display** (semibold, clamp 3.5 to 7rem, 1.02): Hero headlines and large museum numbers only.
- **Headline** (semibold, h1 clamp 2.5 to 4rem at 1.08, h2 clamp 2 to 2.75rem at 1.15): Page and section titles in glaze blue.
- **Title** (semibold, h3 clamp 1.5 to 1.875rem, 1.25): Card titles and dialog titles in glaze blue.
- **Body** (regular, clamp 1 to 1.0625rem, 1.65): Default reading text. Long reading columns cap at 42rem.
- **Label** (medium, 0.875rem, 1.5): Buttons, nav items, badges, and table cells.

### Named Rules
**The Soft Headline Rule.** Large headlines use Fraunces with SOFT 100 and negative tracking. Body copy never uses the display face.

## Layout

The public site uses a 12 column editorial grid inside a 1440px frame. Page gutters run fluid from 16 to 48px, sections stack with 64 to 160px rhythm, and compositions favor asymmetry with one large image against a narrow text block. Standard image ratios are 4:5 for products, 3:2 for workshops, 3:4 for portraits, and 1:1 for thumbnails.

Household profiles use bento blocks for story, certificates, map, and lineage. Traceability pages read as a craft notebook on phones. Maps pair a paper toned basemap with seal pins and a list panel, collapsing to a bottom sheet on mobile. Admin pages use a 14rem sidebar on desktop that becomes a horizontal strip on narrow screens.

## Elevation & Depth

Depth comes from tonal layering and one warm shadow, not stacked elevation. Cards sit on surface fields over paper with a thin ink ring. Grain adds material. Crackle marks verification zones and empty states.

### Shadow Vocabulary
- **Warm lift** (`0 1px 0 rgb(28 24 20 / 0.04), 0 12px 32px -12px rgb(120 60 30 / 0.18)`): Cards, dropdown menus, and dialogs at rest.

### Named Rules
**The Flat-By-Default Rule.** Surfaces stay flat at rest. Shadow appears only on cards, menus, and dialogs, never as decoration on plain content.

## Shapes

Corners stay small and deliberate. Inputs and buttons use a 4px corner, cards use 12px, and chips and badges use a full pill. The seal family breaks this geometry on purpose with uneven hand cut squares for the logomark, the trace frame, and the QR stamp.

Borders are thin ink lines at 5 to 20 percent opacity. The blue wave divider separates sections. Crackle and grain supply texture, never structure.

## Components

### Buttons
- **Shape:** Slightly rounded rectangle (4px radius).
- **Primary:** Fired clay fill with paper text, 44px height, 20px horizontal padding. Darkens toward ink on hover, presses to 97 percent scale with a light spring.
- **Hover / Focus:** Color transition over 160ms with the press easing. Focus shows a 2px glaze outline offset by 2px.
- **Secondary / Ghost / Seal:** Secondary uses a thin ink border on transparent fill. Ghost has no border and washes ink at 6 percent on hover. Seal variant uses seal red for verification and final acceptance.

### Chips
- **Style:** Full pill, 999px radius, small medium text.
- **State:** Seven tones map to meaning: neutral, clay, glaze, celadon for open and success, lacquer for honors, seal for verification, outline for revisions.

### Cards / Containers
- **Corner Style:** Gently rounded card (12px radius).
- **Background:** Surface field on paper.
- **Shadow Strategy:** Warm lift shadow plus a 1px ink ring at 5 percent.
- **Border:** Ring only, no hard border.
- **Internal Padding:** 20 to 24px in tools, looser in editorial zones.

### Inputs / Fields
- **Style:** 4px corner, ink border at 20 percent, paper or surface fill, 40 to 44px height.
- **Focus:** Glaze outline treatment consistent with buttons.
- **Error / Disabled:** Error shifts border and text to seal red. Disabled drops interaction and dims to 45 percent opacity.

### Navigation
- Public header is sticky with blurred paper, logo left, quiet sans links, and a no-JS details menu on narrow screens. Admin nav is vertical in the sidebar and horizontal scroll on narrow screens, with the active item in clay on a clay wash. Skip links appear on focus in ink on paper. Locale switching sits beside the menu.

### Signature Component
TraceSealFrame wraps a QR code in a double seal frame with an 8 character mono code below. SealMark renders the hand cut seal with a garlic vase cutout and a blue wave band, with ink and inverse variants for print and dark blocks.

## Do's and Don'ts

Concrete visual guardrails grounded in the incumbent implementation and BRAND.md.

### Do:
- **Do** keep paper as the page ground and reserve pure white for no permanent surface.
- **Do** set headlines in Fraunces with SOFT 100 and glaze blue.
- **Do** save seal red for stamps, verification, halted states, and final confirmation.
- **Do** pair photos with grain, crackle, or wave ornaments at section breaks.
- **Do** collapse motion to a 150ms fade when reduced motion is requested.

### Don't:
- **Don't** use seal red for ordinary buttons, links, or decoration.
- **Don't** set body copy or tables in Fraunces.
- **Don't** add shadows beyond the single warm lift token.
- **Don't** invent households, makers, prices, reviews, or certifications in visual examples.
- **Don't** use loud marketplace patterns such as discount banners or flashing badges.
