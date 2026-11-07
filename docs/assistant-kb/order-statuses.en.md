# Quote request and order statuses

A quote request moves through these statuses: Draft (you are still editing), Sent (waiting for household offers), Bidding (offers have arrived; the acceptance deadline is seven days after the bidding closing date), Accepted (the order exists), In production, Delivered, Cancelled (you or the village board cancelled, with a reason) and Expired (the bidding deadline passed with no offer, or the 7-day accept window closed).

A household's quotation has these statuses: Submitted (the household is offering), Accepted (you accepted that quotation), Rejected (another quotation was chosen), Withdrawn (the household pulled it back) and Lapsed.

Each household's share of the order (allocation) has: Proposed (waiting for the household to confirm), Confirmed, Declined (the household declined, which cancels an order not yet in production), In progress, Done and Cancelled. The household reports the completed quantity for its allocation; when it reaches the ordered quantity the allocation is done.

Online payment (bank transfer, VietQR, VNPay, MoMo) is in a sandbox phase under ADR-0021 and is not a shipped feature yet; orders are currently followed through production and delivery statuses. You see the latest state of a request on /en/quotes.
