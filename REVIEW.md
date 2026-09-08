# REVIEW.md

The review passes this repository runs beyond `/code-review`'s two axes, and the severity threshold
that blocks a merge. The Standards axis discovers this file on its own — its step 3 gathers
"anything in the repo that documents how code should be written" — so a pass written here runs on
every review with the vendored skill unmodified. That is the same coupling pattern as the spec
template's `Binds:` line: the rule lives in an artifact this repo owns, and the skill picks it up
through what it already reads.

## Severity threshold

Two levels, matching the distinction `/code-review` already draws:

- **Blocking** — a breach of a documented standard (cited: the file and the rule) or an acceptance
  criterion unmet or ticked without evidence. The PR does not merge until the finding is fixed or
  the standard itself is amended in the same PR, with the reason.
- **Advisory** — a baseline smell or a judgement call. Never blocks, but the PR thread answers it;
  silence is not an answer.

## Passes

Each pass runs against the PR's diff.

### Registry equivalents — blocking

The design system is the source of truth for presentational elements. Before writing or approving
one in `apps/web`, read the inventory in `packages/design-system/src/components/`; a hand-rolled
equivalent of a component the registry already exports is a finding. A component the registry lacks
is added with `pnpm dlx shadcn@latest add <component> -c packages/design-system`; hand-roll only
what has no registry equivalent.

The shape of the miss, from PR #77 (#79 row 8): skeleton bars as `animate-pulse` divs (`Skeleton`
existed), the "o" door divider as three styled spans (`FieldSeparator` exists for exactly this), an
inline field error as a bare `<p>` (`FieldError` exists, with `role="alert"` for free). The failure
mode is structural, not carelessness — a Build session writes JSX from what it holds in context, and
this pass is what puts the inventory in front of the diff after the fact.

### Spec identifiers stay in the source — blocking

**A spec identifier may not appear in any string that leaves the source file.** `NFR14`, `ADR-0015`,
`DD5`, `C43`, `story 7`, `#17` — none of them belongs in a test name, a log line, an error message, an
HTTP response body, CLI output, or anything a person reads on screen. They belong in comments,
doc-comments, and commit messages, which is where this repository's traceability actually lives.

The line is **where the string is read**, not what it says:

| Where                                                          | Rule                                                                                                                                                    |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Comments and doc-comments                                      | Cite freely. This is the record, and stripping it would make the repo unnavigable                                                                       |
| Commit messages, PR bodies, `docs/`                            | Cite freely                                                                                                                                             |
| `it` / `test` / `describe` names                               | **No identifiers.** Read in CI output, by someone who does not have the spec open                                                                       |
| `AppError.message`, `logger` messages, thrown `Error` messages | **No identifiers.** Read at 3am by an operator who may not hold the spec at all — and ADR-0005 already says a log line names what it carries for itself |
| `AppError.userMessage` and every rendered string               | **No identifiers**, and `docs/policy/voice.md` would refuse them anyway                                                                                 |
| HTTP response bodies, RSC payloads, CLI stdout/stderr          | **No identifiers**                                                                                                                                      |

**Two reasons, and the second is the one that generalises.** A reader outside this repository — an
on-call operator, a support engineer reading a captured response, a person at a terminal — cannot
resolve `NFR14` to anything, so the citation costs them a line of the message and gives them nothing.
And a citation goes stale silently: spec numbering is renegotiated at Design, while the string that
quotes it is never re-read. A comment that goes stale is read next to the code that proves it; a log
line that goes stale is read alone.

**Say the substance instead.** `"a session that is not an authenticated Admin (NFR14)"` becomes
`"a session that presented no password and no second factor"` — which is both shorter and the thing
the reader actually needed. Where the citation is genuinely load-bearing, move it to the comment
directly above; `packages/domain/src/auth/index.ts`'s `admin_totp_enrolment_failed` is the worked
example.

The audit that produced this rule (#93): **0** identifiers were reaching an HTTP response body or a
rendered Spanish string — `projectClientError` copies `userMessage` only, so the operator-facing
`message` is structurally unable to reach a client. Every breach was in a test name or a log line.

**It is mechanised, so this pass is a reading rather than a search.** `pnpm spec-identifiers` runs
`scripts/spec-identifiers.mjs` over every JavaScript, TypeScript, JSX **and shell** file in the
repository and exits non-zero on a citation in a string, naming the file, the line, the column and the
string. `pnpm test` runs it as the `//#spec-identifiers` task, CI runs it inside the `test` job, and
`verify-before-stop.sh` will not let a session report done with it red.

**Shell is a second tokeniser rather than a widened first one**, because its quoting is not
JavaScript's. All three quoting forms are read — `'…'` takes no escapes, `"…"` interpolates, `$'…'`
has escapes of its own — while a `#` opens a comment only at a word boundary, so `$#` and `foo#bar`
are ordinary text and a comment is still never read. A heredoc body is data at a delimiter the script
names and is skipped whole, while a `${MSG:-a default}` is a word the shell prints and so is read. And `"$NFR8 holds"` names a variable rather than citing anything, exactly
as `${NFR8}` does inside a template literal.

Two things a reviewer still has to do, because no check can:

- **Judge the replacement.** The gate refuses `NFR14`; it cannot tell whether what replaced it says
  the substance or merely got shorter and vaguer. A test name that lost its citation and its meaning
  together is a regression the gate reports as a pass.
- **Watch the comments.** The gate never reads a comment, so it is equally silent when a citation is
  stripped from one. Nothing is to be removed from a comment, a doc-comment or a `docs/` file.

**One boundary, and it is worth knowing where it is.** The walk skips `.agents/` and `.claude/`,
which hold vendored skills — and, since the gate learned to read shell, one file that cannot be
subject to it: `.claude/hooks/gate-test.sh` is the suite that drives this gate, and its fixtures are
the very citations it refuses. So that suite runs the gate over its **neighbours** instead — every
other hook is copied into a fixture tree and read, which is what keeps `build-guard.sh`'s refusal
messages honest. `//#test:gates` already declares `.claude/hooks/**` as an input, so editing one
re-runs the case.

### Recorded proof for a visible change — blocking

**A change that alters what a person sees carries a recorded artifact, and the Evidence table's
seam-3 row links it instead of narrating it.** `ui-evidence-required` in
[`docs/policy/build.md`](docs/policy/build.md) is the rule,
[ADR-0019](docs/adr/0019-ui-change-carries-recorded-proof-not-asserted-proof.md) is why, and
`ui-proof` is the method. This pass is what makes it blocking.

**Why this is a review pass and not a CI job.** A machine can check that a link is present. It
cannot check the thing that matters — whether the artifact shows the criterion it is cited against.
A gate that passes on any link teaches a session to attach any link, which is the failure mode this
pass exists to prevent rather than to automate. The choice is recorded rather than assumed: a sixth
required check was considered and deferred, and `required-checks` is unchanged.

Four questions, in order. The first is a fact; the rest are judgements, which is why a person is
reading.

|     | What to check                                                                                                                                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Does the diff alter what a person sees?** A rendered surface, its copy, its focus order, its states. If it does not, this pass is satisfied and the rest do not apply                                                                                                                                             |
| 2   | **Is there an artifact, and does the medium match the change?** A change in _time_ owes video, a change in _space_ owes a before/after still pair, a change the accessibility tree alone can see owes `diff snapshot` output as text. The table lives in the `ui-proof` skill; a change matching two rows owes both |
| 3   | **Does the artifact show the criterion it is cited against?** Open it. A link beside a criterion it does not demonstrate is worse than prose, because prose does not look like evidence                                                                                                                             |
| 4   | **Is the pair comparable?** Same viewport, same theme, same seeded fixtures, same entry path. A pair differing in anything else diffs on things nobody changed, and the reviewer stops reading                                                                                                                      |

**Three things are not findings**, and saying so is what keeps this from becoming a ritual:

- **An unpaired half whose absence the body explains.** The publisher reports it rather than refusing
  it, deliberately: a session that could capture only one side has to say why, and that sentence is
  the evidence. A missing half with **no** explanation is a finding.
- **A narrowed artifact that names what it could not show.**
  [`docs/policy/security.md`](docs/policy/security.md) forbids recording `/admin/enrol/[token]` and
  anything but seeded fixtures, so some flows cannot be captured whole. Narrowed and named is the
  correct outcome, not a shortfall.
- **No artifact on a change with no visible effect.** An empty `diff snapshot` is the proof, and it
  belongs in the body as a fenced block.

**The failure mode to watch for is the artifact that proves the happy path only.** The states this
repo cares about are `empty`, `loading`, `partial`, `error`, `permission denied` and `success` — six
per surface, fixed in [`docs/policy/ux.md`](docs/policy/ux.md) — and a recording naturally captures
the last one. Where a criterion is about a refusal, a boundary or an empty state, the artifact has to
reach it.

**And a `demo-` capture is checked against its ticket.** A story demo never expires, so a durable
artifact published for a ticket with no spec parent is the one mistake here that cannot be undone by
waiting. `ui-evidence-retention` is the rule; the publisher warns but cannot see the ticket graph, so
this is the place it is actually checked.

### Security review — blocking, when the diff touches auth, the exchange path or an egress

**A PR that changes how a caller proves who they are, what crosses to another person, or what leaves
the system is read adversarially before it merges.** `pentest-cadence` in
[`docs/policy/security.md`](docs/policy/security.md) is the rule — none external, two tiers of agent
review in its place — and this pass is the per-PR tier. The full-platform tier is a `/security-audit`
run, which is periodic rather than a merge gate.

**The reader is the `security-auditor` subagent**, spawned with the PR number, and
[`docs/agents/security-audit.md`](docs/agents/security-audit.md) → "Reviewing one pull request"
carries the path list that decides whether this pass applies and the shape the result is posted in.
The path condition is deliberate rather than lazy: a security review on the PR that changes a font
size is how a reader learns to skim, and a pass that runs on every diff is bypassed the same week.

Three things about the verdict:

- **A `CONFIRMED` `CRITICAL` or `HIGH` blocks.** `MEDIUM` is advisory and the thread answers it.
  `LOW` and below are named once and never block. The severity table is the vendored skill's, and
  its rule that a defence-in-depth gap is a hardening note rather than a finding applies here too.
- **A finding at `MEDIUM` or above is also an issue**, filed under `needs-triage` and
  `security-finding` as the coupling doc says. A PR thread is not a place a finding survives a merge,
  and [ADR-0001](docs/adr/0001-findings-enter-through-triage.md) is where findings enter.
- **A finding that argues with a set policy value is not a finding.** The Wall is public, enrolment is
  open and published as unverified, an Admin is fully trusted. The auditor's return names the row of
  the coupling doc's designed-behaviour table it ruled out, and the reviewer checks that it did.

**What this pass is not** is written down so nobody records it as one: an agent reading code another
agent wrote shares its blind spots. What it buys is that every change to a boundary is read by a
context that was told to break it, not by the one that was told to build it.

## Under stacked PRs

`stacked-prs` is **yes** (`docs/policy/build.md`). Both `/code-review` axes run per PR, against each
PR's own diff. The passes above run once, at the top of the stack, against the whole stack's diff —
a registry equivalent introduced low in a stack and consumed above it is one finding, not one per
PR.

**Security review runs per PR too**, for the same reason recorded proof does: it asks whether _this
diff_ opens a boundary, and a stack whose review sits only at the top has four merges of unread auth
code below it. The path condition is evaluated against each PR's own diff.

**Recorded proof is the exception, and it runs per PR.** The other passes ask a question about the
stack's final state, so asking it five times wastes a reviewer. This one asks whether _this diff's_
criteria are evidenced, and each PR in a stack ticks its own — a stack whose artifact sits only at
the top has four PRs of unevidenced claims and one link that covers a diff nobody can still see. The
per-PR artifact is also the smaller one: it shows what that slice changed, which is the comparison
its reviewer needs.
