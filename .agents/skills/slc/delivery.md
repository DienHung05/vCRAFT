# Delivery decision

Read this after the promise passes the clarification check in SKILL.md. If tracing the outcome exposes a new correctness, safety, or authorization unknown that prevents a defensible promise, return to [SKILL.md's clarification branch](SKILL.md#clarification-needed) before handing back a scope. Known unmet requirements can support a not-ready judgment; they are different from unknown governing facts.

## 1. Separate learning from delivery

If uncertainty is driving the work, name the assumption and what observation would change the decision. Choose the cheapest credible way to obtain that evidence. A prototype, interview, or technical spike may be enough; stop at an experiment recommendation when there is no present need to deliver a usable release. Experiments still need safeguards appropriate to their participants, data, and consequences.

If people will rely on the result, define the delivery scope below, whether the team calls it an MVP, pilot, or release. An experiment may also deliver a complete narrow service. State what it can test and what remains untested, including automation or scale when humans perform the work.

Finish with a clear choice: learning experiment, usable release, or a release that also tests a named assumption. Keep the user's terminology.

## 2. Find a small scope that holds the promise

Apply these tests together:

- **Simple:** Bound the audience, use case, inputs, environment, or service level until delivery fits the actual constraints. Judge simplicity by the total effort to build, operate, and use it, not by button or feature counts.
- **Lovable:** Identify a concrete reason this audience would prefer the result to its alternative. That might be control, relief from tedious work, accessibility, trust, speed, play, or pleasure. Preserve the behavior that produces that benefit. Treat preference as a hypothesis until user evidence supports it; visual polish is only one possible means.
- **Complete:** Trace the promised outcome from entry to usable result, including the dependencies and failure handling needed in that setting. Include relevant setup, permissions, recovery, and ongoing operation. Apply these where the promise requires them, rather than importing a universal feature checklist.

For ambiguous boundaries, read the closest worked case in [examples.md](examples.md). Use its reasoning, not its feature list.

Test scope reductions by asking what the user can still accomplish and why they would still choose it. Keep an adequate scope when reduction serves no actual constraint. A narrower promise can remove a dependency; removing a dependency while keeping the promise breaks completeness. Preserve security, privacy, accessibility, safety, and existing contractual obligations that apply to the retained scope. Confirm uncertain domain obligations with the responsible source or owner. Reduce exposure or change the plan when those requirements cannot fit.

Account for every supplied feature and proposed addition: retain it with a reason tied to the outcome, preference evidence or hypothesis, or an applicable obligation; leave it outside this release with a reason; or identify what would resolve its status. Include missing dependencies exposed by the outcome trace. Give deferred work a revisit condition only when one is justified.

Finish when the retained scope delivers the whole bounded outcome, preserves its reason to be chosen, and has no unexplained omissions. If nothing fits the constraints, recommend a narrower audience or promise, an experiment, or a changed constraint. State the tradeoff instead of declaring an incomplete release sufficient.

## 3. Check the boundary and hand back

Ask whether this would remain useful without another feature release, assuming the maintenance and operation it needs continue. Name any future feature, hidden manual rescue, or unowned operational dependency that the current promise still relies on.

Give observable acceptance checks for the promised result, the preference hypothesis, and material failure cases. Match the checks to the consequences of failure. For a readiness judgment, distinguish demonstrated behavior from plans and unverified claims; identify the evidence still needed before calling it ready.

Return a recommendation with the promise, decisive inclusions and exclusions, and unresolved assumptions or blockers. Use the user's existing artifact or a short answer, whichever fits the decision. A single-feature tradeoff rarely needs a full release document.

Finish when the user can accept or reject a concrete scope and knows how to check it. Carry accepted decisions into the existing implementation or planning workflow. Invoke this skill again only for a new scope decision or evidence that changes this one.
