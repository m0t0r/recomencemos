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

## Under stacked PRs

`stacked-prs` is **yes** (`docs/policy/build.md`). Both `/code-review` axes run per PR, against each
PR's own diff. The passes above run once, at the top of the stack, against the whole stack's diff —
a registry equivalent introduced low in a stack and consumed above it is one finding, not one per
PR.
