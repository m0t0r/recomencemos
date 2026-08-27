/**
 * The runtime backstop, and — unlike `@repo/domain`'s — the only guard this
 * package has.
 *
 * `@repo/domain` can reach for the `server-only` marker package because its
 * Next-only modules are genuinely Next-only. This package's are not: a template
 * is a React component rendered to a *string*, and the two places that render
 * one outside a request are plain `node` — the `email dev` preview server, and
 * every Node-environment Vitest file in `src/templates`. The marker throws
 * wherever the `react-server` condition is unset, and plain `node` sets none, so
 * adding it here would break the preview server and the whole template suite to
 * guard a boundary nothing is currently crossing.
 *
 * What actually keeps this package out of a browser is that no client module
 * imports it, and that it holds `RESEND_API_KEY`. This function is the second
 * line: if a future refactor puts a template on a `"use client"` path, the
 * failure is a loud throw at import time rather than a sending credential and an
 * SDK shipped to every visitor.
 *
 * **This is the package's own rather than `@repo/observability/server-only`.**
 * That one hardcodes its own name into the message and advises importing
 * `@repo/errors` instead, because its reason is `pino`. The reason here is a
 * credential that sends mail, and a backstop that fires with the wrong package
 * name and the wrong remedy is worse than ten duplicated lines.
 *
 * Checked through `globalThis` rather than a bare `window` so the check does not
 * depend on the DOM lib being in a consumer's `tsconfig`.
 */
export function assertServerOnly(moduleName: string): void {
  if (typeof (globalThis as { window?: unknown }).window !== "undefined") {
    throw new Error(
      `@repo/notifications/${moduleName} was imported into a browser bundle. ` +
        "This package is server-only: it holds RESEND_API_KEY and it performs the one " +
        "irreversible act in this system. A browser asks for a send through a Server " +
        "Action or a Route Handler, never directly.",
    );
  }
}
