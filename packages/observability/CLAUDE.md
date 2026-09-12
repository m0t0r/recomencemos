# @repo/observability

Behaviour of the log line this package emits. How to _use_ the logger is in the root `CLAUDE.md`,
under **Logging and errors**.

**A stack on a log line is trimmed by value, and names generated code.**
[ADR-0004](../../docs/adr/0004-stack-frames-are-trimmed-by-value.md) fixes both halves. Runs of vendor
frames collapse to one counted marker, so the budget buys application frames — measured at 79% of a
Next.js request stack spent on `.pnpm` paths before it. And the logger resolves **no** source maps:
mapped frames in development are `node --enable-source-maps`, a process flag rather than a logging
feature, and in production the maps are deleted after upload. So a **thrown** error's mapped stack
lives in the reporting platform, and a **handled** one has none. That last gap is real, and named
there rather than closed.

**The completion line counts what the app routed, and that is a measurement rule rather than a volume
one.** The subscription hears every HTTP server in the process, so an unfiltered line put Turbopack
chunks and HMR in the same population as the app's own requests — about 30:1 on one dev page load. p95
then sat on chunk 304s permanently, the error rate it exists to be the denominator of was diluted by
the same factor, and `route: "unknown"` became one bucket holding 96% of traffic. So an **unrouted**
request emits a line only when `status >= 400`, and the cut is `routeOf`'s own answer rather than a
`/_next/` prefix match — a path denylist would be [ADR-0006](../../docs/adr/0006-name-the-exposure-rather-than-ship-a-heuristic.md)'s
heuristic shipped into the field a drain groups by. A 404 is unaffected; it carries `/_not-found` and
is routed. Restoring a line for unrouted success is not a bug fix, it is reverting #81.
