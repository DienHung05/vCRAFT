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

## Failures and permissions

If Beads cannot open its configured database, report the command and
error. Do not switch trackers or initialize a replacement database.

Tracker configuration does not authorize git commits, git pushes, or
Dolt remote sync. Follow the active repository and session rules.
