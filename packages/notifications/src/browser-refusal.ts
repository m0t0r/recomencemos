/**
 * What a **browser** bundler resolves this package's two published subpaths to,
 * through the `browser` condition in the `exports` map.
 *
 * This is mechanism 1 from [ADR-0013](../../../docs/adr/0013-a-server-only-package-declares-which-guards-it-has.md);
 * `assertServerOnly` in `#server-only` is mechanism 3, the backstop behind it.
 * Until this file existed the backstop was the only guard this package had —
 * which put the weakest of the three around the strongest credential in the
 * repository, while `@repo/observability`, holding no credential at all, had
 * the strongest. That inversion is what [#64](https://github.com/m0t0r/recomencemos/issues/64)
 * was.
 *
 * The difference is when the failure lands. `assertServerOnly` throws *after*
 * the module is in the bundle, so `resend` and the transport source have
 * already shipped and only the execution stops; the condition below fails at
 * module resolution, so they never enter the client graph at all. A runtime
 * throw in development is a thing someone works around. A build error is not.
 *
 * What was actually observed, rather than hoped for — Next 16, Turbopack, a
 * `"use client"` page importing `@repo/notifications/send`:
 *
 * ```
 * ./apps/web/app/leak-probe/page.tsx:3:1
 * Error: Export createTransport doesn't exist in target module
 * > 3 | import { createTransport } from "@repo/notifications/send";
 *
 * The export createTransport was not found in module
 * [project]/packages/notifications/src/browser-refusal.ts [app-client] (ecmascript).
 * The module has no exports at all.
 * ```
 *
 * **And the counterfactual was measured rather than argued.** The same page, on
 * the commit before this one — with `assertServerOnly` as the only guard —
 * `Compiled successfully`, a clean `Tasks: 1 successful`, and these counts
 * across the 35 files of `.next/static`:
 *
 * | string | occurrences |
 * | --- | --- |
 * | `resend` | 152 |
 * | `api.resend.com` | 1 |
 * | `RESEND_API_KEY` | 3 |
 * | `Idempotency-Key` | 1 |
 *
 * So the SDK, the live sending endpoint and the credential's name all shipped
 * to every visitor, and the build said nothing. The issue was careful not to
 * assume that; this is the measurement.
 *
 * Verified from the other side too. With the seam imported from a Route Handler
 * instead, the build succeeds and `.next/static` — 30 files — contains **0**
 * occurrences of `resend`, `api.resend.com`, `RESEND_API_KEY` or
 * `Idempotency-Key`, while `api.resend.com` appears twice in `.next/server`
 * where it belongs. NFR4's "0 bytes" is then a property of resolution rather
 * than something a grep confirms after the fact.
 *
 * **Why not the `server-only` marker package**, which is the usual way: it works
 * through the `react-server` condition, and plain `node` sets none. Two things
 * here run as plain `node` — every Node-environment Vitest file under
 * `src/templates`, and the `email dev` preview server — so the marker would
 * throw in both to guard a boundary neither is anywhere near. That argument is
 * settled in ADR-0013 and in `#server-only`'s own doc comment; this file is the
 * guard that does not have its problem.
 *
 * The `throw` below is therefore not what a named import hits — that fails
 * earlier, on the missing export. It covers the one case a missing export
 * cannot: a bare `import "@repo/notifications/send"` for side effects, which
 * resolves cleanly and would otherwise do nothing at all.
 */

throw new Error(
  "@repo/notifications was resolved for a browser bundle, and it must never be. " +
    "It reads RESEND_API_KEY and it performs the one irreversible act in this system: " +
    "a message that has been sent cannot be recalled. Ask for a send from the server — " +
    "a Server Action or a Route Handler calling the send seam — and let the browser await " +
    "the result.",
);
