---
name: plan-delegate-review
description: Opus plans, the sonnet-implementer subagent writes the code, Opus reviews. Use it for issue work in this repo that is larger than a few edits, to spend fewer Opus tokens on typing code. Not for one-line fixes, which are cheaper to do directly.
---
# Plan → delegate → review

The main session (Opus) does the thinking, and the `sonnet-implementer` subagent (Sonnet) does the typing. Opus tokens go to understanding the problem, writing the plan and reviewing the result, never to long edit loops.

## 1. Plan (Opus)

- Read the issue, then locate the code with CodeGraph (`codegraph_explore`). Read only enough to be sure of the design.
- Decide the approach. Resolve trade-offs, conflicts with ADRs or the SRS, and owner-only steps (production, Vercel, Render, Supabase) here, not in the subagent.
- Create the branch (`<type>/<issue>-<slug>`) and comment `fixing` on the issue, per the GitHub issue workflow.
- Write a **self-contained brief**, because the subagent starts cold:
  - **Goal:** one or two sentences, plus the issue number.
  - **Files:** the paths to change, with line anchors or symbol names when known.
  - **Steps:** a numbered list of concrete changes. Name functions, fields, messages and error codes exactly.
  - **Tests:** which tests to add or update, and what each asserts.
  - **Checks to run:** the exact commands.
  - **Out of scope:** what not to touch.

## 2. Delegate (Sonnet)

Spawn the subagent with the brief:

```
Agent({ subagent_type: "sonnet-implementer", description: "Implement #<issue>", prompt: "<brief>" })
```

- Independent pieces that touch different files can go to separate `sonnet-implementer` agents in parallel.
- While it runs, Opus can plan the next issue, but must not edit the same files.

## 3. Review (Opus)

- Read the subagent's report, then `git diff` (use `--stat` first, then the files that matter). Trust the diff, not the report.
- Check:
  - Correctness against the issue's acceptance criteria.
  - Edge cases.
  - Repo conventions: English in the repo, no EOL-only churn, nothing outside scope.
  - Whether the tests really cover the change.
- Small fixes: make them directly. Larger gaps: send a follow-up brief to the same agent (`SendMessage`) rather than starting over.
- Re-run the key check yourself when the report shows something surprising.
- Then commit, push, open the PR, and finish the issue workflow (merge when CI is green, comment `fixed — <PR>`, close).

## When not to delegate

- A change of a few lines, or one that needs judgment at every step (a tricky merge conflict, a production incident): do it directly.
- Anything that needs production access: open an owner issue instead.
