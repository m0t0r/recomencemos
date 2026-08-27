/**
 * The runtime backstop, and the **second** of two guards rather than the only one.
 *
 * `connection.ts` and `health.ts` also `import "server-only"`, which fails the
 * **build** instead of a request — strictly better, and the reason this function
 * is not the whole story. What it cannot cover is the migrate path: the marker
 * package throws wherever the `react-server` condition is unset, and plain
 * `node` sets none, so `src/migrate/cli.ts` in a Fly `release_command` and every
 * Node-environment Vitest file would die on import. That is the gap this fills.
 *
 * `@repo/domain`'s public subpaths are the only way in, and an unexported one is
 * unresolvable under pnpm's isolated store ([ADR-0010](../../../docs/adr/0010-the-domain-package-is-the-only-door-to-the-database.md)) —
 * so reaching past the domain layer is a module-resolution error rather than a
 * review comment somebody has to notice. This function is the second line: if a
 * future refactor puts a published subpath on a `"use client"` path, the failure
 * is a loud throw at import time rather than a Node TCP client and a connection
 * string quietly shipped to every visitor.
 *
 * **This is `@repo/domain`'s own rather than `@repo/observability/server-only`.**
 * That one hardcodes its own package name into the message and advises importing
 * `@repo/errors` instead, because its reason is `pino`. The reason here is `pg`
 * and the advice is different, and a backstop that fires with the wrong package
 * name and the wrong remedy is worse than ten duplicated lines.
 *
 * Checked through `globalThis` rather than a bare `window` so the check does not
 * depend on the DOM lib being in a consumer's `tsconfig`.
 */
export function assertServerOnly(moduleName: string): void {
  if (typeof (globalThis as { window?: unknown }).window !== "undefined") {
    throw new Error(
      `@repo/domain/${moduleName} was imported into a browser bundle. ` +
        "This package is server-only: it opens Postgres connections through pg, a Node TCP client, " +
        "and it holds the credentials that reach the database. " +
        "A browser reaches the domain through a Server Action or a Route Handler, never directly.",
    );
  }
}
