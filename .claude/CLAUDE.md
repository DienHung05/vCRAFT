<!-- CODEGRAPH_START -->
## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tool** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them, including dynamic-dispatch hops grep can't follow. Name a file or symbol in the query to read its current line-numbered source. If it's listed but deferred, load it by name via tool search.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` prints the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely — indexing is the user's decision.
<!-- CODEGRAPH_END -->

## Plan, delegate, review

For issue work larger than a few edits, the main session plans and reviews, and the `sonnet-implementer` subagent (`.claude/agents/sonnet-implementer.md`, Sonnet) writes the code. This saves tokens on the expensive model. Follow the `plan-delegate-review` skill (`.claude/skills/plan-delegate-review/SKILL.md`): write a self-contained brief, spawn the subagent, then review the diff yourself before committing. Do one-line fixes and production incidents directly.
