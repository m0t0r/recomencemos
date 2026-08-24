---
name: to-intent
description: Turn the current conversation into an intent.md and publish it — the Plan-stage artifact of the AI-native SDLC.
disable-model-invocation: true
---

# To Intent

Take the current conversation and produce the Plan-stage artifact, `intent.md`. Synthesize what you
already know; the interview belongs to `/grill-with-docs`, which is the skill to run first when the
thinking isn't there yet.

The issue tracker should have been provided to you — run `/setup-matt-pocock-skills` if not.

## Process

1. Read `CONTEXT.md` and the ADRs under `docs/adr/` that touch this area. Use the glossary's
   vocabulary throughout the intent. Where the intent contradicts an ADR, say so in **Constraints**
   and give the reason it's worth reopening.

2. Write the intent from the template below. Every open question names what it blocks — that
   naming is what a human approves against.

3. Publish it: follow "Publishing an intent or a spec" in `docs/agents/issue-tracker.md`, with
   `stage: intent`.

4. Report the file path, the issue number, and how many open questions are unresolved.

<intent-template>

## Problem

What is wrong today, told from the position of whoever feels it. Name who that is.

## Proposed outcome

What is true once this is solved, from that same position. Outcomes, not implementation.

## Affected users and systems

Who and what this touches. Name the workspace or service for each system.

## Constraints

What bounds the solution: deadlines, compliance, contracts, and decisions already locked by an ADR.
Link each ADR that binds this work.

## Open questions

The questions Design cannot start without answers to, one line each:

- [ ] **Q1** — <the question>. **Blocks:** <what stays undecided until this is answered>.

Leave every box unchecked. A human checks a box and appends the answer inline when they resolve it.

## Out of scope

What this intent deliberately leaves out, and why.

</intent-template>

## The Plan gate

An intent carries `status: draft` while any open question is unchecked, and a human moves it to
`approved` once they're all resolved. That transition is the Plan → Design gate: `/to-spec` reads
the intent and works only from an `approved` one, reporting the unresolved questions otherwise.
