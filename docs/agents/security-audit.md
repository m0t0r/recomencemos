# Security audit: how the in-house auditor works here

The `security-audit` skill is vendored from `cloudflare/security-audit-skill` and unmodified. It is
the **method**: six phases, a fan-out of hunters by attack class, adversarial validation, a
`findings.json` with a schema. Everything that makes it fit this repository lives in this file, the
same way `issue-tracker.md` couples `/implement` — the skill picks it up through
`.claude/agents/security-auditor.md`, which reads it first. Do not fork the skill.

`docs/policy/security.md` → `pentest-cadence` is the policy this serves: **none external**, and in
its place two tiers of agent review. Neither is a pentest and neither is recorded as one — an agent
reading code another agent wrote shares its blind spots; what the two tiers buy is coverage and
consistency, not independence.

## The three surfaces, and which one you want

| You want                                                                                      | Use                                                                                                                                                              |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A full audit of the platform — before the announcement, after a large auth or exchange change | `/security-audit`, in the main session, with the run configured as "Running a full audit" says below. It spawns `security-auditor` as its hunters and validators |
| One pull request read adversarially                                                           | Spawn `security-auditor` with the PR number. That is the `REVIEW.md` **Security review** pass, and "Reviewing one pull request" says when it applies             |
| One question answered — "is this magic-link flow sound?"                                      | Spawn `security-auditor` with the question and the file paths. Same rules, one scope, no run directory                                                           |

`security-auditor` is a subagent, so it runs in an isolated context with the persona and the rules
fixed in its definition, and it returns text rather than writing files. **The session that spawned it
does the writing** — the run directory, the report, the issues. That split is the vendored skill's
own ("subagents do NOT write files") and it is also what keeps the auditor read-only by contract.

## The trust model, so the auditor does not infer one

**Actors, and what each may do by design.** The vocabulary is `CONTEXT.md`'s.

| Actor                                                                        | Proves identity by                                                                                              | May, by design                                                                                                                                                          |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Anyone on the internet                                                       | Nothing                                                                                                         | Read the Wall and every `PublicProfile`, which is public and indexable on purpose. Start either sign-in door                                                            |
| An Account (Worker or Hirer — one kind of Account, two roles a person plays) | A magic link, or Google; a session on the row, 30 d rolling on an own device, 8 h on a self-declared shared one | Publish and edit **their own** CapabilityProfile, read a `GatedProfile`, send an Offer, accept or reject one, Report, Block, export and delete their own data           |
| An Admin                                                                     | Email and password **plus TOTP**; 8 h, no rolling; enrolled from a shell, never from a form                     | Work the queue: approve or reject a photo, pass or refuse an Offer, handle a Report, revoke a session. **Fully trusted** — an Admin doing Admin things is not a finding |
| The scheduler (Trigger.dev, designed in DD10 and not yet built)              | A shared secret compared in constant time, a timestamp window, idempotency                                      | Trigger a job. It carries **no data** and holds **no database credential**; the reply is `204` with no body                                                             |

**`threat-model-scope` is anyone on the internet.** An unauthenticated attacker is in scope for every
finding; so is an authenticated Account attacking another Account or the Admin boundary.

**The seven trust boundaries are closed by spec.** DD16 in
[`docs/efforts/0002-profile-to-contact-exchange/spec.md`](../efforts/0002-profile-to-contact-exchange/spec.md)
names exactly seven and says the table _"is what `/security-audit` is handed as its input"_. Hand it
to Phase 1 verbatim, so recon confirms an architecture rather than inferring one — and an **eighth
boundary found in the code is a finding of its own**, whatever crosses it, because it is an egress
added at Build that nobody modelled.

## Designed behaviour that is not a finding

Each of these reads as an OWASP checklist failure and is a decision with a document behind it. A
finding here is a policy concern for its owner, filed in the concern format of
`docs/policy/owners.md`, never a vulnerability. The auditor names which row it checked a finding
against, so a reader can see the line was drawn rather than missed.

| Looks like                                          | Is                                                                                                                                                                                                                    |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unauthenticated access to user profiles             | The Wall. `PublicProfile` is public and indexable by design; the sensitive shape is `GatedProfile`, and the finding is one of _that_ reaching an anonymous reader                                                     |
| No identity verification at sign-up                 | [ADR-0008](../adr/0008-open-enrolment-with-published-non-verification.md): open enrolment, and the absence is **published** to every reader. The finding would be a surface implying verification that does not exist |
| No payment security controls                        | [ADR-0007](../adr/0007-the-platform-never-handles-money.md): the platform never handles money. Any code path that does is the finding                                                                                 |
| No reputation, rating or dispute system             | The third refusal in `CLAUDE.md`. A feature quietly reintroducing one is the finding                                                                                                                                  |
| A credential in a URL path segment                  | `secrets-in-url-paths` is **yes**, one route, `/admin/enrol/[token]`, named and bounded. A **second** such route is a finding; the first is a policy value                                                            |
| Unauthenticated reads of published review artifacts | `artifact-egress` is **yes**, under an unguessable prefix. What the artifact **contains** is the audit question — see the policy's "What a published artifact may never contain"                                      |
| No MFA for Workers and Hirers                       | `mfa-requirement` is **Admin only**                                                                                                                                                                                   |
| No `noindex` on profile pages                       | Absent by design (DD16 row 2): the Wall is meant to be found                                                                                                                                                          |
| `console.error` reachable from application code     | The bootstrap allowance in `CLAUDE.md` → Logging and errors. Evidence of misuse is a finding; the allowance is not                                                                                                    |
| Transitive dependency advisories                    | Read daily by `scripts/audit-report.mjs` and routed to `needs-triage`. Do not re-file them; the fingerprint that workflow keys on already does                                                                        |

## Vocabulary: OWASP as the language, never the bug list

Every confirmed finding carries three tags, so a reader who does not know this codebase can place it
and a later run can deduplicate it:

- **OWASP Top 10 2021** category (`A01:2021 Broken Access Control` …) — the reader's map.
- **OWASP ASVS 5.0** requirement (`V4.1.3`) — the verification the code fails, so the fix knows what
  it is restoring.
- **CWE** id — the stable key. It is half of the fingerprint below.

Severity is the vendored skill's table, unchanged, and its two hardest rules apply here with extra
force: a defence-in-depth gap is a hardening note and never a finding, and **a finding that defeats
the exchange path's principal check is `HIGH` even when the blast radius is one person**, because
that is the only boundary this product enforces on purpose.

## Running a full audit

1. **No worktree is needed, and no branch.** An audit writes nothing under version control. The run
   directory is `.security-audit/runs/<YYYY-MM-DD>-<n>/` at the repo root, which `.gitignore` covers;
   pass it to the skill as the output directory instead of its default under the home directory, so
   the run sits beside the tree it read and a second machine finds nothing stale.
2. **Prior runs are issues, not files.** The skill reads earlier `findings.json` files to skip known
   findings; here the durable record is the tracker, because
   [ADR-0001](../adr/0001-findings-enter-through-triage.md) makes a dismissed finding durable
   knowledge rather than a closed file nobody remembers. Before Phase 2, list every issue under the
   `security-finding` label, **open and closed**, and put their titles and fingerprints in the
   architecture summary. A closed `wontfix` is an accepted risk: it is mentioned in the report and
   never re-filed.
3. **Map the skill's roles onto this harness.** Phase 1 (`research`) → the `Explore` agent, with
   DD16's table in each prompt. Phase 2 hunters (`general`) → `security-auditor`, one per attack
   class × subsystem, launched in one message. Phase 3 validators → `security-auditor` again, with
   the finding and the instruction to **disprove** it. Phase 6 → `security-auditor` over the written
   report. `security-auditor` cannot spawn agents of its own; where the skill expects a hunter to
   delegate a rabbit hole, it returns it under **Handoffs** and the orchestrator spawns the follow-up.
4. **Dynamic confirmation runs against this tree's dev server and nothing else.** `pnpm dev` here,
   seeded fixtures, the HTTPS origin `portless` prints
   ([ADR-0018](../adr/0018-a-dev-server-is-reached-by-name-not-by-port.md)); a magic link is minted
   with `curl` against the loopback port, the way the seam-3 leg already does. Never the deployed
   app. Never a live third-party endpoint. Never a real person's data.
5. **Write `REPORT.md`, `FINDINGS-DETAIL.md` and `findings.json` into the run directory** and run
   the skill's `validate-findings.cjs` over the last. Then file, as the next section says.
6. **Post one run summary as a comment on the tracking issue for the audit** if one exists (the
   go-live runbook's §9 row, or the ticket that asked for the run), otherwise as a new
   `security-finding` issue titled `Security audit run <date>` holding the summary, the counts by
   severity, **What holds**, and a link to each finding issue. That issue is what the next run reads
   as its prior.

## Reviewing one pull request

The **Security review** pass in `REVIEW.md` runs when the PR's diff touches any of:

- **Auth** — `packages/domain/src/auth/**`, `packages/domain/src/admin/**`,
  `apps/web/app/(site)/(auth)/**`, `apps/web/app/(token)/**`, `apps/web/app/(admin)/**`,
  `apps/web/lib/{safe-action,admin,auth,ceilings,client-ip,set-cookie,end-session,gated-routes}.ts`
- **The exchange path** — any module carrying an Offer, its approval, its acceptance, or the send
  that follows; and `packages/domain/src/projections/**`, because a projection is what decides which
  fields cross
- **An egress** — `packages/notifications/**`, `packages/observability/**`, the object-store client once it lands,
  `apps/web/next.config.ts` (headers, CSP), `apps/web/instrumentation*.ts`, and any
  `.github/workflows/*` that publishes anything

A PR that touches none of these is not reviewed for security, deliberately: _"a security review on the
PR that changes a font size is how a reader learns to skim"_ (spec 0002, C8).

Spawn `security-auditor` with the PR number. It reads `gh pr diff <n>` and the plan comment on the
ticket, and it reads the **surrounding code**, not the diff alone — a diff that removes one call is
only a finding when the call was the last thing standing between an input and a sink. It returns in
its finding shape; the reviewing session posts the result as a PR review comment under a
`## Security review` heading, `CONFIRMED` findings first, then **What holds**, then the rest.
`CRITICAL` and `HIGH` block; `MEDIUM` is advisory and the thread answers it; `LOW` and below are
mentioned once and never block. A `MEDIUM` or above is **also** filed as an issue, because a PR
thread is not a place a finding survives a merge.

## Filing a finding

Findings enter through triage ([ADR-0001](../adr/0001-findings-enter-through-triage.md)). One issue
per confirmed finding at `MEDIUM` or above; `LOW` and `INFORMATIONAL` live in the run report or the
review comment only.

```sh
gh label create security-finding --color b60205 \
  --description "A confirmed finding from the in-house security audit or a PR security review" 2>/dev/null || true
gh issue create --label needs-triage --label security-finding \
  --title "<severity>: <finding title>" --body-file <path>
```

The body is the finding block from the auditor's return, preceded by the disclaimer `/triage` expects
on anything an agent writes to the tracker, and followed by a fingerprint marker:

```markdown
> _This was generated by AI during a security audit._

<the finding block, verbatim>

<!-- security-finding: <sha256 of "<sink file path>|<CWE id>"> -->
```

The fingerprint is **sink file plus CWE**, not the title — two runs word the same bug two ways, and
the file and the weakness class do not move. Before filing, search the label for the fingerprint;
a match that is open gets a comment with the new run's date, a match closed as `wontfix` is an
accepted risk and is left alone, and a match closed any other way is a regression, filed fresh with
a `Regression of #<n>` line. Use `--body-file`, never `--body` — shell substitution eats backticked
words in an inline body silently.

**The label is not the `security-audit` one.** That label belongs to the daily dependency report,
which `scripts/findings.mjs` edits and closes by its own marker; a hand-filed issue under it would
sit inside another automation's lifecycle.

## What is never in a report, an issue or a run directory

The same list as `docs/policy/security.md` → "What a published artifact may never contain", because
an issue on this repository is public and a run directory is one `git add -f` from being so:

- A live token, a session cookie value, a TOTP secret or backup code, an enrolment URL with its
  token. Quote the **shape** — `/admin/enrol/<token>` — and never the value.
- Any credential from `.env.local`, even a development-tier one.
- A real person's data. Fixtures only; if a finding needs a real row to demonstrate, it is confirmed
  from source and marked as needing deployment testing.
- A working exploit against the **deployed** origin. The proof of concept runs against this tree's
  dev server, and the report says so.

## Still open

- **The exchange path is not yet built**, so the auditor's most consequential scope is empty today
  and the pre-announcement run in the go-live runbook §9 is the first one that will read it. Until
  then a full run measures the doors, the Admin boundary, the projections and the egresses.
- **`validate-findings.cjs` is the skill's, and `pnpm test` does not run it.** A run directory is
  gitignored, so there is nothing for a gate to read; the check runs once, by the orchestrator, at
  Phase 5.
