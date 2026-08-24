# A stack on a log line is trimmed by value, and names generated code

This is a rule about **what a byte budget on a diagnostic buys**, not about one function. `trimStack`
in `@repo/observability` is where it was first applied and is used below as the worked instance, but
the rule binds any future budget this repo spends on a diagnostic payload — a stack, a truncated
request body, a captured breadcrumb list.

**It is the stack-shaped answer to NFR16's second half.** That requirement originally set a byte bound
and said nothing about what the bound preserves, which is the hole every finding on this effort's log
line fell through — the truncated line that dropped `context` whole, the budget spent on framework
paths, the `truncated: true` that named nothing. NFR16 now carries a content half, graded like NFR15
above it. This ADR decides what that half means for a **stack** specifically, and does not restate it.

**The rule, in two halves.**

1. **A budget is spent by value, not only by position.** Trimming a stack keeps the leading frames —
   the throw site is frame 0 — but before it spends a byte on a frame it asks what that frame is
   worth. Runs of consecutive vendor frames collapse to one marker line naming how many were folded.
   The collapse is **unconditional**: there is no knob.
2. **The logger does not resolve source maps.** Frames are named as V8 produced them. Where a process
   wants mapped frames, that is Node's `--enable-source-maps`, set outside this package. No
   source-map consumer enters `@repo/observability`.

## Why position alone spends the budget on the wrong frames

The trim was positional and it was not wrong to be — the throw site really is what an operator reads
first. What position cannot see is that the frames are not worth the same and do not cost the same.

Under pnpm's isolated store a framework frame carries a `.pnpm` path and measures ~250 bytes; an
application frame measures ~110. So the leading frames of a Next.js request — which after the first
one or two are framework internals — are simultaneously the most expensive and the least informative,
and raising the allowance buys more of them at the same ratio.

Measured on a Next.js request stack of 29 frames, run through the shipped `createLoggerOptions` over
an in-memory stream at the default 8 KB bound:

|                | Frames | Bytes | Share of the kept stack |
| -------------- | -----: | ----: | ----------------------: |
| `node_modules` |     18 |  3216 |                 **79%** |
| application    |      8 |   791 |                     19% |

Collapsing the consecutive vendor runs in that same stack produces **872 bytes and retains every one
of the eight application frames** — the whole diagnostic, at 21% of what position-only trimming spent
on a fifth of it.

That is why the collapse is unconditional. A knob would be a second answer to a question with one good
one, and it would cost a new variable declared in `turbo.json` under strict environment mode. The lever
for the developer chasing a framework-integration bug already exists and is `LOG_MAX_LINE_BYTES`, which
under the collapse now buys application frames instead of more `.pnpm` paths.

**Classification is a path test, so it is a pattern the package owns**, not a single hardcoded string.
`node_modules` is the obvious marker; a monorepo has others, and a downstream project will have more.
This is the same treatment `route` gets: a pattern, never the literal.

## Why the logger does not consume source maps

A logged frame names generated code — `apps/web/.next/dev/server/chunks/[root-of-the-server]__0d-m6t_._.js:281:21`
rather than the route file. The obvious fix is to map it in the serialiser. It is the wrong fix, and
the reason is that the two environments differ in a way that leaves nothing for that code to do.

**In development the maps are already on disk** and Node already knows how to use them.
`apps/web/.next/dev/server/chunks/` carries a `.map` beside every chunk — 44 of them as measured.
`node --enable-source-maps` rewrites `error.stack` itself, before pino ever sees the error. Verified on
Node 24.11.0 against a generated file with a handwritten map:

```
default:                at boom (…/scratchpad/smtest/chunk.js:3:9)
--enable-source-maps:   at boom (…/apps/web/app/api/example-error/route.ts:3:1)
```

It is **off by default** — `process.sourceMapsEnabled` reads `false` — so it is a flag someone sets,
not behaviour to rely on. But it is a flag, and a flag is cheaper than a dependency.

**In production the maps are not there to consume.** `apps/web/next.config.ts` sets
`sourcemaps.deleteSourcemapsAfterUpload: true`, and that is not an incidental setting — it is the one
irreversible action in the observability effort, deliberately taken, because maps left in the deployed
output make the app's full source publicly fetchable. In-process resolution in production is therefore
not merely undesirable; there is nothing on disk to resolve against.

So a source-map consumer in the logger would be dead code in the only environment it was wanted for.

## The asymmetry this leaves, stated plainly

`CLAUDE.md` fixes that **thrown is reported; returned is logged**, and the two halves land differently
here:

- A **thrown** error reaches `onRequestError`, so the reporting platform holds the untrimmed error with
  frames resolved against the maps that were uploaded. The log line only has to be a pointer, and it is
  one, via `event_id`.
- A **handled** error returned through `toErrorResponse` produces one `warn` line and no event. In
  development `--enable-source-maps` covers it. **In production nothing does** — the maps are deleted,
  no event exists, and the trimmed generated-code stack on that line is the entire record.

That gap is real and this ADR does not close it. Closing it means either an event for handled errors
(which spends the effort's only quota lever, deliberately reserved) or retaining server maps in the
deployed output (which is the disclosure decision `deleteSourcemapsAfterUpload` already made). Both are
decisions with cost and neither is the logger's to make.

It does not need its own ticket, and giving it one was the mistake this ADR was revised to undo. NFR16
now requires **≥ 1 stack frame naming application code** on a truncated line. In production, on the
handled path, that frame names generated code. Whether that satisfies the requirement is a question the
requirement now asks on its own, of every line, forever — which is strictly better than a separate
issue somebody has to remember to reopen.

## Considered options

**Raise the stack allowance (rejected).** It buys more frames at the same 79:19 ratio, which is the
finding rather than the fix. It also spends the half of the line reserved for the operator message,
`context`, and the fields a query binds to.

**Make the collapse a knob (rejected).** Framework frames do matter when the bug is in the framework
integration, which is not rare in a template. But the count survives the collapse in the marker, the
frames themselves are recoverable from the reporting platform on the thrown path, and
`LOG_MAX_LINE_BYTES` already exists for the developer who wants the whole thing for one session. A new
environment variable would have to be declared in `turbo.json` to survive strict environment mode — a
real cost for a second answer.

**Drop vendor frames silently (rejected).** A stack that omits frames without saying so cannot be
distinguished from a shallow one, which is the same mistake `omittedFramesMarker` already exists to
avoid.

**Bundle a source-map consumer in the serialiser (rejected).** Three counts. Production has no maps to
read, so it is dead where it was wanted. It adds a runtime dependency to a package whose dependency
list is load-bearing. And it puts file I/O and map parsing on the error path, inside the one component
that must not throw.

**Set `--enable-source-maps` for the app's dev server (accepted, but not here).** It is a `NODE_OPTIONS`
or dev-script change in `apps/web`, not a change to this package. Recording it here is what stops the
next person reaching for a library instead. Note that under Turborepo's strict environment mode an
undeclared `NODE_OPTIONS` is filtered out of the task environment entirely, so the variable route needs
a `globalPassThroughEnv` entry or it is silently inert.

## Consequences

- **A diagnostic budget is now spent on what the budget was for.** The line's stack carries application
  frames; the framework frames it folded are still counted in the marker.
- **The trim needs a classification rule, and that rule is now a thing that can be wrong.** A frame
  misclassified as vendor is a frame silently folded. The pattern is owned by the package and is the
  natural place for a downstream project to extend, which means it is also the natural place for a
  downstream project to break — so it is covered by tests at the stdout seam like everything else in
  `createLoggerOptions`.
- **The logger acquires no new dependency**, which keeps `@repo/observability`'s dependency list the
  physical argument it already is.
- **Mapped frames are a process-level flag, not a logging feature.** Anyone who wants them in
  development sets `--enable-source-maps`; nothing in this package has to know.
- **The production handled-error path has no mapped stack, and that is now written down** rather than
  discovered a second time. It is the open question this ADR names and does not answer — but NFR16's
  application-frame clause is what will keep asking it.
- **It generalises past stacks.** The next diagnostic payload this repo has to fit in a budget — a
  truncated body, a breadcrumb list, a captured query — is sized by asking what each part is worth,
  not by taking the first N bytes.
