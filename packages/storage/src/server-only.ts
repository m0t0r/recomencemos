/**
 * The runtime backstop — ADR-0013's mechanism 3, and never the plan.
 *
 * What actually keeps this package out of a browser is `src/browser-refusal.ts`
 * behind the `browser` condition on `./photos` (mechanism 1, in its strongest
 * form). This function is what covers the case resolution cannot: a module
 * inside this package reached some other way, in some future arrangement nobody
 * has written yet.
 *
 * **Duplicated from `@repo/notifications` and `@repo/observability` on purpose,
 * and ADR-0013 answers the review comment that proposes sharing it.** The shared
 * part is the `globalThis.window` check and it is four lines. The part that
 * matters is the package name, the thing it holds, and what to import instead —
 * here a bucket credential and a signing key, where theirs are `RESEND_API_KEY`
 * and `pino`. A backstop that fires with the wrong name and the wrong remedy is
 * worse than ten duplicated lines.
 *
 * **`server-only` is deliberately absent**, and that is ADR-0013's table applied
 * rather than skipped. Mechanism 2 works through the `react-server` condition
 * and plain `node` sets none — and plain `node` is what every Node-environment
 * Vitest file in this package is. The marker would throw across the whole suite
 * to guard a boundary the suite is nowhere near.
 *
 * Checked through `globalThis` rather than a bare `window` so the check does not
 * depend on the DOM lib being in a consumer's `tsconfig`.
 */
export function assertServerOnly(moduleName: string): void {
  if (typeof (globalThis as { window?: unknown }).window !== "undefined") {
    throw new Error(
      `@repo/storage/${moduleName} was imported into a browser bundle. ` +
        "This package is server-only: it holds the bucket credential and the key that signs " +
        "an upload URL, and a signing key in a browser is an upload primitive for anyone who " +
        "opens the tab. A browser asks the server for a presigned URL through a Server Action, " +
        "then PUTs to that URL and nothing else.",
    );
  }
}
