# Issue tracker

This repository uses Beads for all task tracking.

Run `bd prime` for the current workflow and command reference. Follow
the repository's `CLAUDE.md` and active session instructions.

## Working with issues

- Use `bd ready` to find available work.
- Use `bd show <id>` to read an issue.
- Use `bd create` to create issues before implementation.
- Use `bd update <id> --claim` to claim work.
- Use `bd close <id>` to close completed issues.
- Use Beads labels for the roles in `docs/agents/triage-labels.md`.

Engineering skills that normally create GitHub issues or local markdown
tickets must create Beads issues instead. Keep specifications and
acceptance criteria in the Beads issue fields.

Do not use GitHub Issues, `.scratch/` markdown tickets, TodoWrite, or
TaskCreate for task tracking.

## Wayfinding operations

- Create the map as an epic labelled only `wayfinder:map`.
- Create question tickets with `bd create --parent <map-id>
  --no-inherit-labels`. Give each exactly one type label:
  `wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling`, or
  `wayfinder:task`. Triage labels apply to engineering work, not these
  maps and decision tickets.
- Create tickets first, then add native blocking edges with
  `bd dep add <dependent-id> <prerequisite-id>`. The parent-child relation
  records membership; it is not a prerequisite decision.
- Load the map with `bd show <map-id>`. Query its open children with
  `bd query 'parent=<map-id> AND status=open' --sort priority`.
- The frontier consists of open, unassigned children whose blocking
  prerequisites are all closed. Normally use
  `bd ready --parent <map-id> --unassigned --sort priority`.
  Contributor routing can send `bd list` and `bd ready` to the contributor
  planning store even when a project database path is supplied. If the
  command reports that routing, use the project-local
  `bd query 'parent=<map-id> AND status=open AND assignee=none'
  --sort priority`, then inspect candidates with `bd show <ticket-id>`
  and exclude those with any open blocking prerequisite. Do not treat an
  empty result from the other store as an empty frontier or change git
  configuration to work around it.
- Choose by priority, then creation time. Claim with
  `bd update <ticket-id> --claim` before working. Do not take an existing
  assignee away from another session.
- Record the answer with `bd comments add <ticket-id>`, close the ticket,
  and append a named issue link plus a one-line gist to the map. The
  resolution comment holds the detail; the map remains an index. Beads
  references use the real issue ID wrapped in the issue title, for example
  `[Ticket title](actual-beads-id)`.
- Query children instead of listing open tickets in the map body. Keep
  unshaped questions under `Not yet specified` and ruled-out work under
  `Out of scope`.
- Charting creates the map without resolving its child decisions. Later
  sessions resolve at most one non-research child. Research branches or
  remote publication require separate authorization under the active
  session rules.

## Failures and permissions

If Beads cannot open its configured database, report the command and
error. Do not switch trackers or initialize a replacement database.

Tracker configuration does not authorize git commits, git pushes, or
Dolt remote sync. Follow the active repository and session rules.
