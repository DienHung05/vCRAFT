# Worked scope decisions

These are hypothetical cases. Claimed preferences and numeric targets require evidence or explicit agreement in the actual task. Choose the case with a similar decision, even if its domain differs.

## A desktop tool: fewer settings, complete control

Request: "Ship a window-dimming tool. Do we need saved profiles, scheduling, and per-monitor rules?"

Assumption: the target user wants to reduce the brightness of a chosen window during the current session.

Promise: adjust and restore a chosen supported window without changing other windows.

Retain selection, adjustment, visible feedback, and restoration. Verify what happens when the target closes or becomes unsupported. A dim action without a dependable way back leaves the user stuck. Leave profiles, schedules, and monitor rules outside this release because they address other situations. Revisit profiles if repeated setup becomes an observed burden.

The preference hypothesis is direct control without disrupting other work. Check that a target user can dim and restore the intended window without affecting a neighboring one, and compare the effort with their current workaround. A prettier indicator alone does not establish preference.

Boundary: if the user instead needs their setup restored every morning, persistence may belong in the promise. The same feature changes classification when the situation changes.

## A CLI: preview can be the reason to choose it

Request: "Cut this bulk-renaming CLI to a small first release: regex, recursive folders, preview, undo, and saved presets."

Assumption: one directory and a literal replacement rule solve the initial user's job; files are valuable.

Promise: rename matching files in one directory with inspectable changes and a defined recovery path.

Retain preview, collision checks, and a way to report and recover from partial failure. Exclude regex, recursion, and presets. Decide whether undo is necessary from the recovery requirements; a proposed mapping is not automatically a working recovery mechanism.

Preview earns its place because users currently fear an irreversible mistake. Test collision rejection, interruptions, and the agreed recovery behavior on disposable files. Ask a target user to inspect a representative rename before committing it. Fewer flags would not compensate for losing that control.

Boundary: if the deadline excludes safe execution, offer a preview-only planner under a different promise. It is complete as a planner, not as a renaming tool.

## A service pilot: learning and usable delivery together

Request: "Before automating appointment booking, can we run an MVP through email?"

Learning question: will customers accept the proposed appointment options and service terms? Define an observation and a decision threshold with the owner before interpreting the pilot.

Promise: within stated service hours, an operator confirms an available appointment or tells the customer none is available. Assume a staffed pilot with capacity for the invited group.

Retain availability checking, confirmation, change or cancellation handling, appropriate treatment of customer data, and an accountable operator. Defer a customer portal and automated matching. Make the service window and turnaround explicit; an unstaffed inbox cannot deliver the promise.

The preference hypothesis is less back-and-forth than arranging appointments themselves. Observe completed bookings and customer effort. This pilot can test demand and service usefulness. It does not demonstrate that scheduling automation works or that the service scales economically.

Boundary: manual fulfillment is legitimate delivery when it is dependable within the agreed scope. It is a gap when it depends on an unspecified person rescuing every failed transaction.

## An existing product: a necessary addition under a deadline

Request: "For CSV export, can we omit permission checks and build scheduled delivery instead?"

Known constraint: users may access only their own organization's records.

Promise: an authorized user obtains a usable export of the records they are allowed to view.

Retain authorization and correct serialization. Check the supported data and size limits, safe handling in the intended consumer, and visible failure rather than a success message for a truncated result. Offer on-demand export before scheduling if it satisfies the stated need. Existing access obligations still apply to this new output.

The preference hypothesis is avoiding manual copying. Check a representative export in the intended downstream tool and verify cross-organization access is denied. A generated file is not enough if the consumer cannot use it.

Boundary: if the actual requirement is an unattended nightly handoff, scheduling is part of completeness. Renegotiate that requirement or the deadline rather than silently substituting an on-demand workflow.

## A game: pleasure belongs in the retained scope

Request: "One playable puzzle or ten rough levels for the first public release?"

Assumption: a short standalone puzzle is an acceptable offer, and the target audience values a satisfying solve.

Promise: play and finish one puzzle, with enough feedback to understand the rules and a restart after failure.

Retain readable state, responsive controls, the complete puzzle, feedback, and restart. Leave progression, an account system, and additional levels out. Test whether new players can understand and finish the puzzle, then gather evidence that the experience itself was enjoyable. Completion alone does not show that a game is worth playing.

Boundary: one puzzle is insufficient if the product still promises a campaign. Change the offer as well as the level count.

## A feasibility spike: stop before release scoping

Request: "Can this parser process our largest sample within the memory limit? Build a disposable benchmark."

The decision concerns technical feasibility, not a usable release. Establish the sample, memory limit, and measurement method; run the relevant experimental workflow. Auth, onboarding, and a lovable experience do not help answer this question.

Boundary: if the next request is to give the parser to analysts, a new delivery decision exists. Scope accepted inputs, usable outputs, failure behavior, and integration then.
