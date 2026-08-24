/**
 * What a **browser** bundler resolves every server-only entry of this package
 * to, through the `browser` condition in the `exports` map.
 *
 * This is the mechanism; `assertServerOnly` is the backstop behind it. What was
 * actually observed, rather than hoped for — Next 16.3.2, Turbopack, a
 * `"use client"` module importing `@repo/observability/logger`:
 *
 * ```
 * ./apps/web/app/leak-probe.tsx:3:1
 * Error: Export logger doesn't exist in target module
 * The export logger was not found in module .../src/browser-refusal.ts [app-client]
 * ```
 *
 * So the failure is a **build** error, not a runtime one, and `pino`,
 * `pino-pretty` and their stream packages are not in the client graph at all —
 * NFR4's "0 bytes" becomes a property of resolution rather than something a grep
 * confirms after the fact. Verified from the other side too: with the package
 * imported from a Route Handler, `pino` is in `.next/server` and there are 0
 * occurrences of it, `pino-pretty`, `thread-stream`, `sonic-boom` or
 * `@pinojs/redact` across the 27 files in `.next/static`.
 *
 * The `throw` below is therefore not what a named import hits — that fails
 * earlier, on the missing export. It covers the one case the missing export
 * cannot: a bare `import "@repo/observability/logger"` for side effects, which
 * resolves cleanly and would otherwise do nothing at all.
 *
 * **Why not the `server-only` package**, which is the usual way to do this: it
 * works through the `react-server` condition, which nothing outside an RSC
 * bundler sets. Under this package's Node test environment `import
 * "server-only"` throws on import — confirmed against `server-only@0.0.1`, whose
 * non-`react-server` entry is a bare `throw` — so all 51 tests here would fail,
 * and the only fix is to claim `react-server` in `vitest.config.mts`, a
 * condition the test environment does not satisfy. Owning the condition costs
 * one file and keeps the seam honest.
 */

throw new Error(
  "@repo/observability is server-only and was resolved for a browser bundle. " +
    "It depends on pino and its stream packages, none of which belong in a client bundle. " +
    "Import @repo/errors instead — it is isomorphic and has no dependencies.",
);
