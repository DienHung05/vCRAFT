---
version: 1
slug: "apps-web-src-app-locale-auth-dang-nhap-page-tsx"
primary_target: "apps/web/src/app/[locale]/(auth)/dang-nhap/page.tsx"
related_targets: ["apps/web/src/features/auth/auth-shell.tsx"]
---

Scope: shared auth shell for every page under apps/web/src/app/[locale]/(auth): sign-in, sign-up, forgot and reset password, invitation, and the household wizard. Visitor mode: Operate (finish sign-in fast) with an owner-requested signature experience. Build path: code-led; approved static comp (critique reference): scratchpad comp/kiln-auth-comp.html, owner-approved 2026-11-02.

Audience and job: buyers (incl. foreign), household reps on phones over 4G, admins. Sign in or create an account without friction; the page should feel like stepping up to the village kiln.

## Direction contract
THESIS: The sign-in is a firing. The form is a glazed tile in front of a kiln mouth, and a successful sign-in stamps the trace seal. It refuses the centred card on a flat page.
OWN-WORLD: Theme-following scene. Dark is charcoal #14110F with an ember glow rising from below, drifting embers and heat shimmer. Light is dó paper with a faint clay kiln glow and fine clay/lacquer dust. Cobalt hoa lam brush strokes (vine, lotus, wave band) curl around the card. The card is an opaque surface tile with a glaze rim line and a pointer sheen. Fraunces headings sit in glaze blue, and the primary button is clay.
STORY: The visitor recognises vCraft's seal, signs in, and sees the seal stamped as confirmation. Errors read plainly and are announced.
FIRST VIEWPORT: At 1280px, a full-bleed scene sits between the header and footer. On the left are a 240px glowing trace seal and the tagline in Fraunces. On the right (cols 8-12) is the 440px tile with the h1, lead, fields, the primary button and links. At 360px, a 72px seal sits above a full-width tile, with a brush curl peeking from top-right.
FORM: Structure from the owner's brief (pinned direction, no roll). Signature interaction: submit fires, embers stream to the seal, and the seal stamps (scale 1.4→1, ease.press). That is followed by a 520ms hold and a cross-document view transition. Error: crackle and a ≤280ms shake. Motion grammar: ease.clay entrances, ease.kiln state, ease.press stamp; reduced motion gives static art and 150ms fades. No concept roll was made: the owner pinned the direction in the request (impeccable new-work: "a user- or brief-pinned direction beats the roll"), so no seed reference exists for this surface.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
