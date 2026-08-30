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

**Not yet mechanised, and that is a known gap.** The right shape is a table-driven repo-shape test in
the manner of `apps/web/gated-routes.test.ts` and `domain-boundary.test.ts`, scanning test names and
message strings so the rule is red rather than reviewed. It lands with the repo-wide sweep of the
pre-existing sites, because a check that cannot be green cannot be turned on.

## Under stacked PRs

`stacked-prs` is **yes** (`docs/policy/build.md`). Both `/code-review` axes run per PR, against each
PR's own diff. The passes above run once, at the top of the stack, against the whole stack's diff —
a registry equivalent introduced low in a stack and consumed above it is one finding, not one per
PR.
