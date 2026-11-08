# ADR-0023: Outage notices target village areas and show from the start of the day until the cut ends

**Status:** Accepted, approved by the maintainer on 2026-11-08
**Date:** 2026-11-08
**Deciders:** Maintainer
**Tracks:** GH#294 (follows GH#250, audit finding s6-08)

## Context

A published `POWER_SCHEDULE` notice names an affected area as free text. Until now the Studio outage banner
showed every notice of the village date to every approved household, so households in an unaffected area
were warned too. The banner also stayed on screen after the cut had ended.

Three things had to be decided: how an area is identified and which households belong to it, how notices
without a clear area are handled, and when the banner is shown. The banner intentionally warns before an
electric firing starts, so that advance warning must stay.

## Decision

### Areas

- Village areas are a fixed list in `packages/domain` (`village/areas.ts`): `BAT_TRANG` (Thôn Bát Tràng) and
  `GIANG_CAO` (Thôn Giang Cao). Notices have one more audience, `VILLAGE_WIDE` (Toàn xã), which is not a place
  a workshop can be in. The codes are stable identifiers; display names live in the i18n messages
  (`villageAreas`).
- Each workshop has an optional `areaCode` (one of the two hamlet codes), edited by the household in the
  Studio workshop editor and shown to the administrator in the household review. It is never assigned
  automatically: the map data holds only the commune boundary, not hamlet boundaries, so a pin cannot
  suggest a hamlet. A suggestion from the pin can be added when hamlet boundaries exist.
- A household belongs to the areas of its workshops. Updating a workshop without sending `areaCode` keeps the
  stored area; sending `null` clears it.

### Audience

- A household is affected by a notice when the notice is `VILLAGE_WIDE`, or any of its workshops has the
  notice's area.
- A household with no workshop area set (no workshop at all, or none with an area) receives **all** outage
  notices: warning too many households is better than missing one. Its Studio shows a prompt to set the
  workshop area. The prompt is shown only while no workshop has an area.
- A household with several workshops, some with an area and some without, is matched on the areas it has.
  This can miss a cut that only affects the workshop without an area, which is why the prompt asks for an
  area on every workshop.
- Administrators see every outage notice.

### Notice area and legacy notices

- Each outage in a `POWER_SCHEDULE` notice gets an `areaCode` (a hamlet code or `VILLAGE_WIDE`), chosen in the
  admin news editor. The free-text `area` stays as a description for readers and is never used to decide who
  is warned.
- A notice stored without an `areaCode` (legacy) is treated as `VILLAGE_WIDE`. Its free text is never mapped
  to an area, to avoid silently misclassifying it. The editor shows such a notice as village-wide and saves
  that choice explicitly.

### Timing

- All times are in the village time zone, `Asia/Ho_Chi_Minh`.
- The banner shows from 00:00 of the outage's village date until the outage end time, and disappears from the
  end time on. The time before the start is the advance warning.
- A cut lies within one village date (its start is before its end), so it cannot cross midnight. A cut over
  midnight is entered as two cuts, one per date.

### Access

- Only approved households and administrators fetch outages. Pending, rejected and suspended households make
  no request, guests are denied, and responses stay `private, no-store`.

## Options considered

- **Map the free-text area to a hamlet.** Rejected: names vary ("Xóm 2", "Giang Cao") and a wrong guess
  would hide a warning.
- **Only warn households whose area is set.** Rejected: households that have not set an area would miss
  cuts. Over-warning is safer.
- **Banner only during the cut.** Rejected: it would remove the advance warning before an electric firing.
- **Assign a hamlet from the workshop pin.** Not possible yet: there are no hamlet boundaries.

## Consequences

- Workshops have a new nullable `area_code` column (migrations for PostgreSQL and MySQL). Existing workshops
  have no area, so every household keeps receiving every notice until it picks one.
- The outage response gains `areaCode` per outage and `needsWorkshopArea` for the Studio prompt.
- The demo data also names other hamlets (for example Kim Lan). Adding one means adding its code to the list
  in `packages/domain` and its display names to the messages; no migration is needed.
- Code: `outageAudience`, `outageReachesHousehold` and `activeOutages` in `packages/domain/src/news/structured.ts`,
  used by `NewsService.todayOutages`.
