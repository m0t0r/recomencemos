---
status: proposed
---

# UI change carries recorded proof, not asserted proof

`docs/policy/build.md`'s definition of done has four conditions, and three of them are machine-checked
on purpose — _"a definition of done that only a human can evaluate is a definition of done that
erodes."_ The fourth is condition 3: where a change touches `apps/web`, it has been verified
**running**, through `next-dev-loop` rather than a green build, because Vitest cannot reach an `async`
Server Component.

That condition is correct and it is the one with no artifact. What reaches the reviewer is the
agent's own account of what it saw.

**This is measured rather than argued.** Every other row of a PR's Evidence table names something a
reviewer can re-run — a test file and a test name, or a command. The seam-3 rows name a narrative.
From [#145](https://github.com/m0t0r/recomencemos/pull/145), the two shapes side by side:

| Criterion                              | What proves it                                                                                      |
| -------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Reachable and operable from a keyboard | `publish-form.test.tsx` → _is reachable and operable from the keyboard alone_                       |
| Posts the request without leaving      | Seam 3: _"filled the headline and full name, opened the option, sent the request, and read both …"_ |

The second row is a claim sitting in the same table as six citations. It is not a dishonest claim —
that session did drive the browser, and it found and fixed a real defect doing so — but the reviewer's
only options are to take it or to re-run it by hand, and the leg carrying the most product risk is the
one they cannot check. `REVIEW.md` already says a criterion ticked with no evidence is a finding. This
record closes the gap that made one category of criterion structurally unable to carry any.

## The decision

**A change that alters what a person sees ships with a recording of the agent verifying it, hosted by
us, linked from the PR body's Evidence table.**

Three parts, and the second and third are what keep it from becoming a ritual:

1. **Capture** is `agent-browser`, which `next-dev-loop` already requires at `>= 0.31.1` and which
   already drives the seam-3 leg. Nothing new enters the toolchain except `ffmpeg`, which the CLI
   shells out to for video.
2. **The medium is chosen by what changed**, not by how big the ticket is — a rule, not a judgement
   call. Size is a proxy a session can argue with; the axis in the skill is not.
3. **The lifetime is chosen by whether the ticket has a spec parent.** Review proof answers "did you
   check this" and expires once that answer is spent. A story demo answers "what does this look like
   working", which is a question that starts being asked at merge rather than ending there.

`.agents/skills/ui-proof/SKILL.md` is the method, `docs/policy/build.md` holds the keys, and
`docs/agents/issue-tracker.md`'s Build session is the procedure. That is the same three-way split
`CLAUDE.md` already draws, and this record exists because two of the choices below are precedent
rather than preference.

## Why we host the artifact ourselves

The obvious route is GitHub's own attachments, and it is closed twice over.

**There is no API for them.** Attachment upload is a browser drag-and-drop against
`user-attachments`; the REST surface has no endpoint. So an agent wanting GitHub's own storage would
have to drive `github.com` in a real browser.

**That would put the agent on the merge button.** `build-to-deploy-gate.sh` rule F is load-bearing
precisely because merging must be an act the agent _cannot perform_, and it enforces that by reading
the commands the agent runs. A browser session on a pull request page is one `click` away from Merge,
and no hook watches `agent-browser click`. Trading the strongest gate in the Build stage for a
convenience is not a trade this repo makes — it is the argument
[ADR-0017](0017-work-is-written-in-a-worktree-and-merged-into-the-default-branch.md) makes for rule K,
one stage later.

**And the fallbacks do not reach.** Measured rather than recalled: GitHub's markdown sanitizer strips
`<video>`, and video served from `raw.githubusercontent.com` is blocked. On a public repository an
image embeds from a raw URL and a video does not, at all. So inside a PR body the reachable media are
an animated GIF — no controls, no scrubbing, multi-megabyte — or a click-through to the blob viewer.

A page we serve has no sanitizer. `<video controls>` works, and so does a before/after pair the
reviewer can scrub. **Self-hosting is not a preference here; it is the only route that leaves rule F
intact.**

**What decides the store is the lifecycle rule, and the vendor is a policy answer rather than this
record's.** The requirement is an object store that expires an object on its own — because the thing
this design promises is deletion, and the alternatives that keep artifacts in git can only promise the
appearance of it. `ui-evidence-hosting` in `docs/policy/build.md` is where the answer lives and it is
**Cloudflare R2**, chosen because it is the object store this operator already has credentials for and
its lifecycle rules are per-prefix, which is exactly the shape the two retention classes need. Another
store satisfying the same two properties would satisfy this record; changing the value is a policy
edit, not an amendment here.

## Why the prose stays in the PR body

The tempting shape is one rich report carrying the architecture, the reasoning and the media
together. It was considered and refused, on this repo's own precedent.

**The plan is a comment and not a `plan.md` for exactly this reason** — the playbook commits a file,
`docs/agents/issue-tracker.md` does not, and the stated reason is that the plan is decomposition
rather than the audit trail. A hosted report holding the architectural narrative is a `plan.md` with
better CSS: a second source of truth, drifting from the first, pulling the reviewer out of the diff
they are reviewing.

So the split is by **lifetime**, and it falls where the media does:

| Layer                     | Medium                                    | Where           | Lifetime  |
| ------------------------- | ----------------------------------------- | --------------- | --------- |
| What changed structurally | `show-me` diff sketches, mermaid          | PR body         | Permanent |
| Why it changed            | Prose                                     | PR body         | Permanent |
| That the agent checked it | Video, before/after stills, snapshot diff | Hosted          | Expiring  |
| That the story works      | One clip                                  | Hosted, durable | Kept      |

The first two rows are text, so they render natively in a PR body, stay in git, and are reviewable
against the diff. **The hosted artifact is a media viewer, not a document**, and it is generated from
the PR body rather than authored beside it — which is what makes drift impossible rather than
discouraged.

## What may never be recorded

A recording captures the address bar, and `secrets-in-url-paths` in `docs/policy/security.md` is
**yes**: `GET /admin/enrol/[token]` carries a live credential in a path segment. A recording of that
screen published to a URL is that credential published to a URL — and unlike the log line, whose
exposure that key bounds by a fifteen-minute lifetime and an operator sitting at the prompt that
printed it, an artifact is fetched by anyone holding the link, later.

The rule is therefore absolute rather than mitigated, and it sits in the skill and in the security
policy both: **that route is never recorded**, and every capture runs against seeded fixtures rather
than real or realistic personal data.
[ADR-0009](0009-a-workers-full-identity-is-gated-and-never-indexed.md) gates a Worker's full identity;
an artifact is an egress like any other.

The durable half sharpens this rather than inheriting it. Expiry bounds a mistake to the retention
window. A story demo has no expiry, so a mistake in one is permanent — which is why the durable prefix
takes the same rule with none of the tolerance.

## Considered options

**Keep asserting it in prose.** The status quo. It is what produced an Evidence table whose
highest-risk row is its only unfalsifiable one, and it will go on producing that, because nothing about
writing a good narrative gets harder as the surface grows.

**GIF only, embedded in the PR body.** No host, no credential, no expiry machinery — genuinely
tempting. Refused because a GIF has no controls: a reviewer cannot pause on the frame they doubt, scrub
back, or step. For a phone-first product where the thing under review is often a focus order or a
transition, "watch it loop and hope" is not review. A GIF remains the right medium for a short
before/after loop and the skill says so; it is not a substitute for the artifact.

**GitHub Pages from a branch.** Renders HTML, costs nothing, needs no credential. Refused because
**git never forgets**: removing a directory in a later commit leaves the blobs in history, so "removed
when merged" would be cosmetic and the repository would grow monotonically. It is 4.3 MB today. An
object store with a lifecycle rule is the only arrangement where the deletion this design promises is
the deletion that happens.

**CI records both sides.** The most deterministic option — check out the base, record, check out the
head, record. Refused because the "before" run needs a seeded database in CI, and `CLAUDE.md` is
explicit that the moment a test or a CI job needs a database, seam 2's whole argument has been lost.
The before-capture is cheap in a Build session for an unrelated reason: the worktree is already at
`origin/<default>` when it opens, so the before is free if it is taken **first** and expensive if it is
reconstructed at PR time.

**One lifetime, everything expires.** Simpler — one prefix, one rule, no decision for the agent to
make. Refused because the durable half is the half that compounds: effort 0002 carries seventeen
`Must` stories, and a clip per story is what makes that issue legible to someone reading it a year
from now. The cost is bounded and small; the loss is not recoverable once the artifact is gone.

## Consequences

**`ffmpeg` joins the toolchain, and it fails at the worst possible moment.** `agent-browser` shells out
to it for video and not for screenshots. Measured on a machine without it: `record start` printed
`✓ Recording started`, the flow ran, a screenshot saved, and only `record stop` reported
`✗ ffmpeg not found`. An agent would drive an entire verification believing it was recording and lose
all of it. **The preflight belongs before `record start`, not after** — that is the first thing the
skill does, and it is why it is written as a rule rather than left to the error message.

**A criterion verified at seam 3 now names an artifact.** Where a change alters what a person sees, the
Evidence table's seam-3 row carries a link the way its other rows carry a test name. Where nothing
visible changed, `agent-browser diff snapshot` output is pasted as a fenced text diff — free to host,
greppable, permanent, and closer to what `REVIEW.md` and the accessibility requirements actually care
about than any number of pixels.

**A merged PR must not end up pointing at a 404.** The artifact expires; the link in the permanent
record does not. Whatever expires an artifact also rewrites the line that pointed at it, to say what it
showed and that it is gone. A dead permalink in an audit trail is a known failure mode here, and this
design would otherwise manufacture one per merged PR.

**The agent is not present when the artifact should die.** Rule F means the session ends at "PR
opened"; merging is the human's act, hours or days later. So expiry can be neither an agent's step nor
a policy sentence — it is the object store's lifecycle rule plus a `pull_request: closed` workflow,
which also catches the PRs that are closed rather than merged. That mechanism arrives with the
pipeline; this record fixes that it may not be a good intention.

**The bucket is a human's step.** Provisioning, the lifecycle rule and the CI credential are things an
agent may not do, so they are a runbook obligation and a ticket of their own rather than a paragraph
somebody is trusted to have followed.
