---
name: spec-review
description: Check a finished spec.md against the advisories it was built from, and append what the synthesis lost to ## Flagged concerns. Pass --adversarial to also re-run the four lenses against the finished document.
disable-model-invocation: true
---

# Spec review

`/to-spec` already gets its concerns from four isolated advisors, so the Flagged concerns list is
not the self-satisfied list a lone author produces. **What Phase B cannot catch is what Phase C
did** — the architect overriding an advisor, softening its point until it is toothless, or losing it
between four documents and one.

That is this skill's default job: **fidelity**. It is a different question from "is this spec any
good", it is much cheaper than re-running five lenses, and it is the failure mode the three-phase
architecture actually has.

It writes **one section**: `## Flagged concerns`. Everything else it reports. A reviewer that edits
**Deep dives** or **Implementation** has become a second author and brought the authoring bias back
with it.

## Process

### 1. Find the spec

Work in the effort folder the user names. Where they name none, take the one
`docs/efforts/<NNNN>-<slug>/` holding a `spec.md`, and ask when more than one qualifies.

Read it, the `intent.md` beside it, and confirm `advisories/` exists. **No advisories means the spec
was not written through Phase B** — say so and stop, or offer to run the adversarial mode below,
which does not depend on them.

A spec already `status: approved` is still worth reviewing. Say so plainly in your report: any
concern you append is unchecked, so the Design gate will stop tickets that were previously allowed.
That is the correct outcome, not a problem to work around.

### 2. Dispatch the fidelity check

One `spec-fidelity` subagent, given the effort folder. It reads every advisory against the finished
spec and returns what was dropped or diluted, with counts.

### 2b. Run the shape checks yourself

While the fidelity agent works, walk the spec against three mechanical checks. They are cheap, they
need no advisory to compare against, and each one is a defect class effort 0001 actually shipped:

- **Every bound has its second half.** An NFR that caps, limits, truncates, or times out must also
  state what the constrained output still contains. A bound alone passes green when everything is
  lost — three post-merge bugs on effort 0001 were one NFR missing this sentence.
- **Every normative list states what membership means.** A list of files, calls, or fields with no
  sentence saying what inclusion implies has at least two readings, and Build will pick one without
  you. The builder and the reviewer misread the same list the same way once already.
- **Every NFR's `Binds:` line is non-empty**, and every bound story exists. `/to-spec` C6 reports
  this at authoring time; re-check it here, because concerns appended since can orphan a story.

A failed check becomes a concern in step 5 like any other finding — you are still a merger, not an
author, so name the defective requirement and what shape it lacks rather than writing the missing
half yourself.

### 3. Adversarial mode — `--adversarial`

Only when the user asks, or the stakes justify it: dispatch `security-advisor`, `data-advisor`,
`operability-advisor`, and `simplicity-advisor` in **one message**, against the **finished** spec,
with the instruction to challenge rather than advise — *what is wrong with what this says*, not
*what should this say*.

This is a second full pass and costs four more spawns. It earns that on a change that carries
money, personal data, or a one-way migration; it does not earn it on every spec. Dispatch all four
when you dispatch any: deciding one has nothing to say is you holding a lens you were supposed to
have given away.

### 4. Merge, never triage

You are a merger. **Dropping a finding is the owner's call, not yours** — the moment you filter on
plausibility you are the author again.

- **Already in the spec's concerns list** — drop it, and say which check re-found it. That is the
  list working, and it is worth one line in your report.
- **Two sources, one decision** — merge into one concern naming both.
- **Two sources, opposite conclusions** — one concern stating both positions, with
  `**Owner:** Tech lead (arbitrating <edge> vs <edge>).`
- **Anything else** — it goes in. A finding you think is wrong goes in **with your reason appended**,
  so the owner resolves it in one pass instead of asking you what you meant.
- **A clean `overridden`** — not a finding. The architect rejected an advisory and gave the reason;
  report the count and move on.

### 5. Write the concerns

Append to `## Flagged concerns`, in the format `docs/policy/owners.md` gives, numbering on from the
highest **C** already there. Replace `_No concerns raised._` when it is the only content. Where the
section is missing entirely, add it above **Out of Scope** — and note that
`.claude/hooks/design-to-build-gate.sh` should have refused that spec on write, so its absence is
itself worth reporting.

Keep each concern's original **owner role** and its **risk** line. Where a check proposed an answer
it would defend, keep that too — a concern carrying a proposal gets resolved, one asking an open
question gets deferred.

Leave every box unchecked, and leave `status:` alone. The gate refuses your approval regardless; the
point is that the human approving is reading a list they can trust to be complete.

### 6. Stamp `reviewed:`

Set the spec's `reviewed:` frontmatter to today's date, and append the mode — `2026-08-22 fidelity`
or `2026-08-22 fidelity+adversarial`. It tells whoever approves what kind of list is in front of
them.

### 7. Report

- How many concerns you appended, and the owner role each waits on.
- The fidelity counts per advisory: settled, flagged, overridden, diluted, dropped.
- Every `dropped` and `diluted` item, quoted beside what replaced it — this is the part the human
  most needs and the part easiest to summarize away.
- Any contradiction between sources, and how you wrote it up.
- Anything the fidelity check listed under "Observed, not in scope".

Close by saying the spec is still `draft`, and that a human resolving these with their owners and
setting `status: approved` is what lets `/to-tickets` run.
