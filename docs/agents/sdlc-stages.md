# The Design and Build stages, in depth

Read this before a `/to-spec`, `/spec-review`, `/prototype` or `/implement` session. The root
`CLAUDE.md` keeps the gates and the rules every session needs; this is the method only those sessions
use.

## The Design stage

`/to-spec` runs three phases, and the ordering is not stylistic: the interview is a pipeline, so the
API depends on the entities and an advisor spawned before the API exists is guessing.

1. **Draft** — the architect alone, in interview order: user stories (prioritized `Must`/`Should`/`Could`) → non-functional requirements (with numbers) → core entities → API contract → high-level design. Seams checked with the user.
2. **Consult** — `security-advisor`, `data-advisor`, `operability-advisor`, `simplicity-advisor` fan out in isolated contexts and return **advisories**, committed to `docs/efforts/<NNNN>-<slug>/advisories/`. The UX lens runs in the main session because one of its cases interviews the user.
3. **Synthesize** — the architect writes the deep dives, records every override in **Further Notes**, and proposes ADRs where a deep dive sets durable precedent.

**Each non-functional requirement names the user stories it binds.** That `Binds:` line is the whole coupling to Build: `/to-tickets` cuts one ticket per story and copies the spec's criteria onto it, so a bound NFR becomes an acceptance criterion without `/to-tickets` needing to know anything new — the coupling lives in the artifact we own, not in a skill we vendored. An NFR binding no story is a finding.

**A spec whose answers end in steps only a human can take carries a `## Runbook obligations` section, and that section is a ticket.** It is the same coupling seen from the other side, and it exists because a runbook step is not a tracer-bullet vertical slice — provisioning a bucket, printing backup codes, filing a DPA — so `/to-tickets`' default reading treats it as prose and drops it. The section's rows become the ticket's acceptance criteria and the runbook file is what the ticket works through; `docs/agents/issue-tracker.md` carries the mechanics, and `/to-tickets` is **not** forked for it. A spec that names a human-only step and produces no ticket has moved that work nowhere.

**Advisors advise; the architect writes.** An advisory that arrives as a finished section is read
for its analysis and rewritten — five authors produce five documents stapled together and bury the
conflicts the Flagged concerns list exists to surface.

**Deep dives are selected by which NFR the high-level design does not already satisfy.** That is
where infrastructure enters: as the answer to a number, never as a section called "infra".

`ux-design` is a **router**, not a rulebook — `impeccable` already owns interface craft at depth, and
`DESIGN.md` owns the visual system. Do not restate either one in a spec.

`/spec-review` is a **fidelity check** by default: one agent comparing the committed advisories
against the finished spec for anything dropped or diluted. `--adversarial` re-runs all four lenses
against the finished document, and costs four more spawns.

Prototypes at Design are the one exception to "no code yet": throwaway branch, never promoted, and
proposed rather than auto-run. `/prototype` LOGIC answers a state-model or API-shape question;
`/prototype` UI answers "which alternative wins" and needs an existing page to sit against.

## Recorded proof in a Build session

**And where the change alters what a person sees, that second leg is recorded rather than narrated**
([ADR-0019](../../docs/adr/0019-ui-change-carries-recorded-proof-not-asserted-proof.md)). Every other row of
an Evidence table names something a reviewer can re-run — a test file and a test name, or a command.
The seam-3 row named a narrative, which made the leg carrying the most product risk the only one that
could not be checked. `ui-proof` is the method, `ui-evidence-*` in `docs/policy/build.md` holds the
keys, `pnpm ui-proof publish --pr <n>` is the command, and `REVIEW.md`'s **Recorded proof for a
visible change** pass is what blocks a merge on it. Three things are worth knowing before you reach
for it:

- **The before is taken first**, right after the worktree opens and before the first edit. The tree is
  already at `origin/<default>` at that moment and never again — reconstructed at PR time it costs a
  second checkout and a second dev server against a shared database.
- **The medium is decided by what changed, not by ticket size** — a change in _time_ is video, a
  change in _space_ is a before/after still pair, and a change the accessibility tree alone can see is
  `diff snapshot` output pasted as text. Size is a proxy a session can argue itself out of. **The
  skill owns that table**, deliberately: which artifact a change owes is craft rather than an answer
  only this organization can give, so it is not a policy key and this summary is not its source.
- **`ffmpeg` fails at `record stop`, not at `record start`.** `agent-browser` shells out to it for
  video and not for screenshots, so without it a session drives an entire flow, sees
  `✓ Recording started`, and loses all of it one command later. Preflight it.

**The prose stays in the PR body and the artifact is a media viewer.** The structural half of "what
changed" is a `show-me` diff sketch or a mermaid diagram written in the body, which renders natively,
stays in git, and is reviewable against the diff. A hosted page holding the architectural narrative is
a `plan.md` with better CSS — the second source of truth this repo already refused once when it made
the plan a comment.

**What is never recorded is in `docs/policy/security.md`**, and it is not a matter of care: a
recording captures the address bar, `/admin/enrol/[token]` carries a live credential in a path
segment, and an artifact is fetched by whoever holds the link, later.
