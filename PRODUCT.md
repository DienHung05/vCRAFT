# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Primary user is the buyer. When tradeoffs collide, the buyer's need wins. Buyers are retail and wholesale customers, including foreign customers, on desktop and mobile. They find a fitting household, send a quotation request, compare quotations, and track progress.

Other audiences, confirmed:
- Guest: visitor with no account, mostly on phone. Scans a QR on a product, reads the traceability page fast, trusts the origin, finds an open workshop.
- Household representative: person acting for one approved craft household, usually on a phone at the workshop with a camera and 4G. Registers products and journal entries, receives quotation requests, submits offers. Mid to low digital skill.
- Village administrator: village administration staff on desktop. Approves households, publishes news, coordinates large orders.
- System: background jobs for media, expiry, and notifications. Not a person.

## Product Purpose
vCraft is a web platform for the administration of one traditional craft village. It exists because counterfeit goods blur trust, maker stories go untold, and large wholesale orders exceed one household and get split by phone today.

The product stands on four pillars: a digital exhibition of households, traceability of each product through a production journal plus QR, a quotation and order coordination flow with controlled states, and an interactive village map.

Success means the January 2027 defense demo and grade first. The team aims at full Must-level function coverage plus visible beyond-spec points, where each grading criterion shows on the product or in code within about 30 seconds. A live pilot with a real village is not the goal of this phase and stays undecided.

## Positioning
"The maker's seal." Each product carries a trace seal, a QR inside a seal frame, that links who made it, how, and when. Verified household identity, a tamper-evident production journal, and a state-controlled quotation flow back that seal. vCraft is not a retail marketplace. One deployment serves one village and is configured for another craft through per-category production stage templates.

## Operating Context
Seed village is Bat Trang pottery village. Real content for it is still unsourced.

Core workflows, all factual from the spec: a buyer sends a quotation request such as 5,000 logo cups in one month, matched households submit sealed offers, the buyer accepts one, and the administration splits large orders across households with confirmed allocations. Households publish journal entries per product stage with photo proof. Guests scan the QR and read the traceability page on a phone. Administrators review household files side by side with papers and a map polygon check.

Operating facts: times stored in UTC and shown in Asia/Ho_Chi_Minh. Base currency VND as integers, with a reference USD display for foreign buyers. One deployment serves one village. Address data follows the two-level model in force since 01/07/2025. Identity comes from Supabase Auth; vCraft stores its own profiles, roles, and states. Web and API share one origin behind Caddy, so no CORS. Workshop work happens on phones; administration happens on desktop; QR codes must scan on the examiners' phones over public HTTPS at demo time.

## Capabilities and Constraints
Confirmed capability groups: auth and accounts with Supabase as identity provider, household approval, household and workshop profiles, products and production journals, traceability and QR, catalog and discovery, village map, quotation requests and sealed offers, orders with split and allocation, community news, notifications, media pipeline, and the Fox assistant, which reads public data only.

Constraints: three students, about nine weeks. Grading is a live demo plus oral defense with no slide deck, so everything must be visible or pointable in code fast. Map uses MapLibre or an equivalent open library. Stack is settled: Next.js 16 with React 19, NestJS with Fastify adapter, MikroORM on Supabase Postgres 17 with a MySQL 8.4 independence check, BullMQ with Redis, Supabase Storage over S3, Zod 4 contracts shared by frontend and backend.

Out of scope for this version: online payment, shipping integration, native mobile apps, e-invoices.

Undecided: whether any live village pilot follows the defense, and which village and households would join it.

## Brand Commitments
Name vCraft, tagline "Tinh hoa làng nghề, muôn phương lan tỏa". Concept "the maker's imprint" and the trace seal are binding. Voice is warm, respectful, short, addressing the reader as bạn, with no hard-sell language. The Fox assistant speaks as tớ and is slightly playful but stays short and states business facts plainly. Full visual tokens live in docs/BRAND.md and packages/ui; they are not repeated here. No binding aesthetic direction beyond what the user already pinned in BRAND.md.

## Evidence on Hand
None in hand. No confirmed households, no licensed Bat Trang photos, no testimonials, no village permissions. All exhibition content still needs sourcing. Future work must not invent households, makers, reviews, prices, or certifications. Seed targets from the spec are at least 20 households, at least 200 products with 4 to 7 journal entries each, at least 10 quotation requests across all states, and at least 15 news items, but none of this exists as sourced content today. Photos must come from clearly licensed sources with full credit.

## Product Principles
- The buyer breaks ties. When buyer clarity conflicts with maker or admin convenience, the buyer path stays shorter.
- Everything gradable is demonstrable. A feature that cannot show in the demo or in code within half a minute does not count.
- Claims stay checkable. Approval, verification, and journal integrity marks say exactly what was reviewed and never imply physical authenticity.
- Phones first where work happens. Journal entries, offers, and QR reads must work fully on a mid-range phone.
- One village in depth. Depth of one village's exhibition and coordination beats marketplace breadth.

## Accessibility & Inclusion
WCAG 2.2 AA: contrast at least 4.5:1, full keyboard use, clear focus, correct ARIA, mandatory alt text. Mobile-first responsive from 360px to 2560px, with the household studio fully usable on a phone. Honors prefers-reduced-motion. Vietnamese is the default language, English second, with localized URLs. Usability testing with at least 5 users including at least one older low-tech user, target SUS 80 or higher.
