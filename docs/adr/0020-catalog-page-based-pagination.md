# ADR-0020: Page-based pagination for product catalog

**Status:** Accepted  
**Date:** 2026-11-03  
**Deciders:** Architecture team

## Context

The product catalog list (`GET /api/v1/products`) on the public site (`/[locale]/san-pham`) currently uses cursor-based pagination with infinite scroll and a "Load more" button. The architecture document (§11, line 682) specifies "cursor pagination (no OFFSET)" as a performance rule to avoid slow OFFSET queries on large tables.

However, the UX requirement for the public catalog is to show numbered page links (e.g., `‹ 1 2 … 10 11 ›`) that users can share and jump to directly. This requires knowing the total count and supporting page numbers in the URL (`?page=N`), which cursor pagination cannot provide.

## Decision

We accept page-based pagination **exclusively for the public product catalog list** as a documented exception to the cursor-only rule.

### Rationale

1. **Scale is bounded:** The public catalog shows only `PUBLISHED` products from `APPROVED` households. In practice, this is a few hundred items at most for a single craft village, not tens of thousands.

2. **Filters reduce result sets:** Users typically apply category, household, price, or stock filters, further reducing the set that OFFSET traverses.

3. **Indexes support the query:** The existing indexes on `(status, household_id, publishedAt)` and `(status, category, priceVnd)` make the filtered and sorted queries efficient even with OFFSET.

4. **UX value is high:** Shareable page links, direct jump to page N, and visible page counts are standard catalog UX patterns. Cursor pagination with infinite scroll does not support these.

5. **Cursor mode remains available:** The API continues to support cursor-based pagination for other use cases (e.g., mobile app infinite scroll, background sync).

### Implementation

- The `ListProductsQuery` schema accepts an optional `page` parameter (int, 1 to 10,000).
- When `page` is present, the service uses `em.findAndCount` with `offset = (page - 1) * limit` and returns a `ProductPageDto` with `{ data, nextCursor, page, pageSize, total, totalPages }`.
- The API rejects requests with both `page` and `cursor` parameters (validation error).
- Cursor-based mode remains the default when neither `page` nor `cursor` is specified (backward compatible).

## Consequences

### Positive

- Public catalog supports numbered pagination with shareable links.
- Total count and page count are available for UI rendering.
- Implementation is straightforward (OFFSET + COUNT in one `findAndCount` call).
- Cursor mode is unaffected for other callers.

### Negative

- OFFSET performance degrades linearly with page depth. At 12 items/page, page 50 (item 600) is still acceptable on an indexed query, but page 1000 would be slow.
- Mitigated by: (1) capping `page` at 10,000, (2) catalog size is bounded, (3) filters reduce the result set.

### Alternatives considered

- **Cursor with client-side page estimation:** Cursor pagination can estimate "pages" by dividing the cursor position by the page size, but it cannot jump to arbitrary pages or show total pages. Rejected because it does not meet the UX requirement.
- **Keyset pagination with explicit page links:** Build page links by encoding the keyset (e.g., `?after=2024-10-01T12:00:00Z:abc123`) for pages 1, 2, ..., N. Rejected because it requires precomputing page boundaries, which is complex and still does not provide a total count.
- **Pre-cached page boundaries:** Cache the first item ID of each page. Rejected because cache invalidation on insert/delete/filter change is complex and error-prone.

## References

- ARCHITECTURE.md §11 (line 682): "cursor pagination (no OFFSET)"
- FR-CAT-01, FR-CAT-02: Public catalog requirements
- vCRAFT-dzk: Numbered pagination implementation
