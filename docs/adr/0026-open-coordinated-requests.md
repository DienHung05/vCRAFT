# ADR-0026: Coordinated quotation requests are open to qualifying households

**Status:** Accepted, decided on the maintainer's standing instruction on 2026-11-10
**Date:** 2026-11-10
**Deciders:** Maintainer
**Tracks:** GH#389

## Context

A household sees a quotation request only through an invitation: the buyer picks it, the system matches it
(BR-05, up to 10 households), or the village administration invites it on a coordinated request. A household
outside the top 10, or one that declared capacity only recently, never sees the request and cannot offer to
help. Household representatives expect to find and pick up work themselves.

The source brief (`docs/requirements/vCraft.pdf` section 3) says the system sends the request to suitable
households, which the invitation model satisfies. The glossary defines a quotation request as private (no
public tender), and FR-RFQ-06 keeps offers sealed. Any change has to keep both.

## Decision

**Option C: open coordinated requests.**

- A request is **open** while it has `coordinationOptIn`, an administrator has claimed it, and the bidding
  deadline has not passed.
- Eligibility: an `APPROVED` household whose representative is not locked, and that has declared production
  capacity greater than 0 for the request's category **or** has a published product in that category.
- An eligible household sees a **redacted summary** of each open request: category, quantity, bidding
  deadline, delivery deadline and required-by date. It never sees buyer identity, budget or attachments.
- An eligible household can send a **contribution offer** without an invitation. Sending the offer adds the
  household to the request's invitation list, so invitations, notifications, the sealed rules of FR-RFQ-06,
  editing and withdrawing (FR-RFQ-05) and the cooperative quotation flow work unchanged.
- The administrator still assembles the cooperative quotation. The household never prices the whole request.
- Requests without coordination stay invite-only. BR-05 (matching up to 10 households) is unchanged.
- The open list is a separate rule (BR-05a). It does not widen who BR-05 invites.

## Options considered

- **A. Keep invite-only.** Rejected: it leaves the stated need unmet. Households outside the top 10 or with
  new capacity still cannot offer help.
- **B. Opt-in board with approval** (households ask to be invited and the buyer or administrator approves).
  Rejected: it adds a second approval loop for little gain over C, since the administrator already curates
  the cooperative quotation.
- **C. Open coordinated requests.** Chosen: it keeps the request private (no public tender, buyer identity
  and prices hidden, offers sealed), reuses the administrator-curated flow where extra capacity is really
  needed, and lets more households offer help.

## Consequences

- A new household-facing list of open coordinated requests returns only redacted summaries; the full request
  stays behind the invitation check. Sending an offer creates the invitation implicitly.
- The invitation list is no longer only chosen by the buyer, the matcher or the administrator, so the list of
  invited households grows as households opt in. The administrator can see who offered through the existing
  contributions view.
- Households with a locked representative, pending, rejected or suspended status, or no capacity or published
  product in the category, get neither the list entry nor the right to offer.
- SRS FR-RFQ-03, FR-RFQ-04, FR-RFQ-06, new BR-05a and the glossary entry for the quotation request are
  updated. A follow-up implementation issue covers the API, the Studio list and the tests.
