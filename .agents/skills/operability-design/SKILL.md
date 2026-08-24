---
name: operability-design
description: The operability lens on a spec — SLIs and SLOs, control bands, the four golden signals, structured logging, rollback classes, and the release moment. Load when writing or advising on a spec.md.
---

# Operability design

The question this lens asks is narrow and unforgiving: **how would anyone know this broke, and what
happens then?** A spec that cannot answer it has described a feature that works until it doesn't and
then waits for a human to complain.

**This lens is an addition to the playbook, on purpose.** ADR-0001 commits this repo to a Maintain
stage that escalates on control-band breaches, and nothing else in the artifact chain decides what
those bands are. Set here, or Maintain has nothing to fire against and the loop back through
`/triage` never closes.

Policy — the observability vendor, the alert destination, on-call, default targets, log retention —
lives in `docs/policy/operability.md`. A value recorded there as `UNSET` becomes a **flagged concern
naming the file and the key**. This template has no deployment, so most of them are.

---

## 1. Pick the SLI before the SLO

An SLO on the wrong indicator is worse than none: it goes green while users suffer. Pick the
indicator from what the user actually experiences, in one of three shapes:

| SLI type         | Measures                                        | Use when                                            |
| ---------------- | ------------------------------------------------ | --------------------------------------------------- |
| **Availability** | good requests ÷ valid requests                  | The user notices the request failing                |
| **Latency**      | requests faster than a threshold ÷ all requests | The user notices it being slow                      |
| **Quality**      | correct or complete responses ÷ all responses   | Degraded answers are served instead of errors       |

Two rules that decide whether the number means anything:

- **Measure as close to the user as you can afford.** A server-side timer that excludes the network
  and the render is measuring your comfort, not their experience.
- **Latency is a ratio, not an average.** "p95 under 200 ms" is an SLO shaped as "99% of requests
  complete in under 200 ms." Averages hide exactly the tail the user is complaining about.

Then set the target from **what the user expects**, not from what the system currently does. Ratchet
a target down as you earn it; never set it to today's number and call that a commitment.

---

## 2. Control bands

**Every spec names at least one band.** A band is three things, and a band missing any of them is
not yet a band:

1. the **metric** — something already measured, or something this change starts measuring,
2. the **normal range**, as a number,
3. **what happens outside it** — who learns, through what, and how fast.

A band with no number is a wish. Where the number is genuinely not yours to pick, flag it **carrying
the range you would defend** — a concern with a proposed number gets answered, one asking "what
should this be?" gets deferred.

**Name the user stories that carry an SLO** and what it is. Not every story does; the ones users
notice failing do. A story whose failure is invisible until a human complains has no
instrumentation, and that is the finding.

### The four golden signals

Use them as the completeness check on a change's instrumentation, not as four metrics to emit by
reflex:

- **Latency** — and distinguish the latency of *failed* requests, which is often fast and flatters
  the average.
- **Traffic** — how much demand. Without it, a latency spike and a traffic spike look identical.
- **Errors** — including the ones returning HTTP 200 with a wrong body. Those are the expensive kind.
- **Saturation** — how full the constrained resource is. Name **which** resource; every system has
  one that gives first, and a spec that cannot name it has not found it yet.

---

## 3. The release moment

**Cache entries do not survive a deploy** — the key includes the build ID. Every release therefore
starts with an empty cache, which makes the release moment the **peak load on everything upstream**:
the exact opposite of the steady state the spec was reasoned about.

A spec relying on caching to stay inside a band says whether the upstream survives the cold window.
That is the same fact `data-design` states about correctness; here it is a capacity question, and it
is the one most specs get wrong because the steady-state arithmetic looks so comfortable.

---

## 4. Rollback

**Say how the change is undone, and how long that takes.** The classes differ by orders of
magnitude, and the spec should name which one it is in:

| Class                         | Undone by                | Cost      |
| ----------------------------- | ------------------------ | --------- |
| Behind a flag                 | Flipping the flag        | Seconds   |
| Code-only                     | Redeploying the previous build | Minutes |
| Additive migration            | Redeploy; the column stays | Minutes  |
| One-way migration             | **Not undone** — only rolled forward | Hours to never |

Where `data-design` marks a migration one-way, **this lens names the forward fix**, because "roll
back" will not be available when it is needed. A one-way migration with no forward fix written down
is the single most expensive omission a spec can carry.

---

## 5. Logging

- **Say what is logged and at what level** for the paths this change adds. Logs nobody specified are
  logs nobody reads.
- **Structured, with a stable key set.** A log line is a query target, not a sentence. Name the
  fields that let someone find the one request they care about — a request id, the actor, the
  resource, the outcome.
- **A log line inherits the classification of what it contains.** Anything `data-design` marked
  `personal` or `secret` does not go into one, and a spec that logs a whole request object has just
  logged everything in it.
- **Log the decision, not just the outcome.** "Access denied" is one bit; "access denied: role
  `viewer` lacks `accounts:write` on `acct_123`" is a debuggable event.
- In development, `logging.browserToTerminal` puts browser console errors into `next dev` stdout.
  That is a dev-loop convenience, not observability — the production destination is a concern unless
  the policy file has fixed one.

---

## 6. What the escalation carries

**The escalation path is fixed** — a breach becomes a `needs-triage` issue and reaches Plan only
when `/triage` promotes it (ADR-0001). What is *not* fixed is what that issue contains, and the spec
decides it.

Name what the alert must carry so the person triaging at 3am is not reverse-engineering it: which
band broke, the observed value against the expected range, the affected surface, and the first thing
to check. An alert that says only "latency high" costs its reader the whole diagnosis.

---

## Advisory output

When running as `operability-advisor`, return analysis — never spec prose, never a finished section.
The architect writes the spec.

- **Recommend** — what the spec should settle, with the indicator or number that makes it decidable.
- **Risk** — what the draft as written leaves unobservable, and the failure that goes unnoticed.
- **Concern** — what only the On-call lead can settle, in `docs/policy/owners.md`'s format, with the
  `**Unblocks by setting:**` line where a policy key is the blocker. Always carry a proposed number.
- **Handoff** — what you need from another edge. One-way migrations come from `data-design`; SLOs on
  user-visible latency depend on the states `ux-design` commits to.

---

**Done when** the spec names at least one complete control band, every SLO-carrying user story has
its number, the saturating resource is named, the release moment is addressed wherever caching holds
a band, the rollback class is stated (with a forward fix wherever it is one-way), and every new log
line has a level and a classification.
