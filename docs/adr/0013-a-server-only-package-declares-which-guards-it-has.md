---
status: proposed
---

# A server-only package declares which of the three guards it has

Three packages here are server-only — `@repo/observability`, `@repo/domain`, `@repo/notifications` —
and each one guards that boundary differently. Every difference is defensible and each is argued in a
doc comment at the site. **What did not exist was the question.** Nothing told the author of the next
server-only package that there was a choice to make, so the `server-only` marker package was
considered in one of the three and reached for in one, and the runtime backstop was hand-copied into
all three from whichever sibling was open at the time.

This record fixes the vocabulary and the order of preference. It moves no code.

There are **three** mechanisms, not one, and they are not alternatives — they fail at different
moments and a package may hold more than one:

| #   | Mechanism                                                                                                   | Fails at                                            | Covers                                                                                         | Costs                                                                                                                               |
| --- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **The `exports` map** — withhold the subpath, or point it at a refusal module under the `browser` condition | Module resolution, so **build**                     | Every bundler and plain `node`. Nothing from the guarded module enters the client graph at all | One manifest entry; one file if a refusal module is used                                                                            |
| 2   | **`import "server-only"`** — the marker package                                                             | Build, but **only inside the `react-server` layer** | A Client Component importing a Next-only module                                                | A dependency, and it **throws in plain `node`** — which is Vitest's Node environment, a Fly `release_command`, and a preview server |
| 3   | **`assertServerOnly()`** — the `globalThis.window` check                                                    | Runtime, at import                                  | Anything that got past 1 and 2                                                                 | Ten lines, per package                                                                                                              |

## The rule

**Mechanism 1 is the mechanism. 2 is a narrowing of it. 3 is a backstop and is never the plan.**

A new server-only package answers three questions in this order, and records each answer where the
code is:

1. **Which subpaths does it publish at all?** Anything a consumer does not need is withheld. An
   unexported subpath is unresolvable under pnpm's isolated store, which is
   [ADR-0010](0010-the-domain-package-is-the-only-door-to-the-database.md)'s whole argument. This
   costs nothing and is not optional.
2. **Do the published subpaths carry a `browser` condition pointing at a refusal module?** They
   should, unless there is a reason not to. This is the only mechanism that keeps the dependency out
   of the client graph rather than throwing once it is there —
   `packages/observability/src/browser-refusal.ts` carries the observed Turbopack error and the
   verification from both sides.
3. **Is the module Next-only?** Only then does `import "server-only"` apply, and only on that module.
   The marker resolves to an empty module under the `react-server` condition and to a bare `throw`
   under every other, so a module that also runs under plain `node` cannot carry it.

Then, always, mechanism 3.

## Why each package answered differently, so the differences read as answers rather than drift

- **`@repo/observability`** uses 1 with a `browser` condition on every entry, and 3. Not 2: its own
  suite runs in Vitest's Node environment, where the marker throws on import, and the only fix would
  be claiming `react-server` in `vitest.config.mts` — a condition that environment does not satisfy.
- **`@repo/domain`** uses 1 (withholding the schema, both connections and the auth instance), 2 on
  `connection.ts` and `health.ts`, and 3 everywhere. Not 2 on `migrate/cli.ts`, which runs as plain
  `node` in a Fly `release_command`.
- **`@repo/notifications`** uses 1 (only `./send` and `./templates/*` are published) and 3. Not 2: a
  template is a React component rendered to a _string_, and the two places that render one outside a
  request — the `email dev` preview server and every Node-environment test — set no `react-server`
  condition.

## Why the backstop is duplicated three times rather than shared

Deliberate, and it is the one place in this repo where copied lines are the right answer.

The ten shared lines are the `globalThis.window` check. Everything else in the function is the part
that matters: **the package name, the thing it holds, and what to import instead.**
`@repo/observability` says _pino and its stream packages, import `@repo/errors`_; `@repo/domain` says
_a Node TCP client and the credentials that reach the database_; `@repo/notifications` says _it holds
`RESEND_API_KEY` and performs the one irreversible act in this system_. A backstop that fires with
the wrong package name and the wrong remedy costs a debugging session; ten duplicated lines cost
nothing, and a shared helper taking the name and the remedy as arguments would be the same three
strings with one more indirection.

**What was actually missing was never the helper. It was this table.**

## Considered options

**A shared `assertServerOnly` in `@repo/errors`.** It is isomorphic and has no dependencies, so it
could host the check. Rejected above: it collapses ten lines and keeps the three strings, which is
the wrong half to share. Worth revisiting only if the _check itself_ gains substance — a second
environment probe, say — at which point three copies would genuinely drift.

**Standardising on `server-only` everywhere.** The obvious move, and the one this repo would have
made by default if nobody asked. Rejected on evidence rather than taste: it breaks two of the three
packages' test suites and the email preview server, because plain `node` sets no `react-server`
condition. That fact is worth stating once here so nobody re-derives it a third time.

**Leaving it in doc comments.** The status quo. It produced three correct decisions and no shared
vocabulary, and the failure mode is exactly what happened: the strongest mechanism was applied in one
package and never considered in the other two.

## Consequences

**A new server-only package walks the three questions and records its answers.** CLAUDE.md carries
the table so it is read at the moment a package is created rather than found afterwards.

**One gap is now visible, and naming it is this record's first dividend.** `@repo/notifications` has
mechanism 1 in its withholding form but **no `browser` condition** on `./send` or `./templates/*`, so
`assertServerOnly()` — a runtime throw — is the only thing between a `"use client"` import and
`resend` plus the code path that reads `RESEND_API_KEY` entering the client graph.
`@repo/observability`, which holds no credential, has the stronger guard. That inversion was invisible
while each package argued its own case in its own file. It is filed as [#64](https://github.com/m0t0r/recomencemos/issues/64) for `/triage` per
[ADR-0001](0001-findings-enter-through-triage.md) rather than fixed here, because this record moves
no code and the fix touches a manifest, a new module, and the resolution assertions in
`apps/web/notifications-boundary.test.ts`.

**The runtime backstop stays duplicated.** A review comment proposing to share it is answered by this
record, not re-argued.
