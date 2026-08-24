/**
 * The runtime backstop on a boundary the dependency graph already enforces.
 *
 * `@repo/observability` depends on `pino`, `pino-pretty`, and their stream
 * packages, none of which belong in a browser bundle (NFR4). What actually keeps
 * them out is that no client module imports this package — the same physical
 * argument that gives `@repo/errors` an empty dependency list. This function is
 * the second line: if a future refactor puts this package on a `"use client"`
 * path, the failure is a loud throw at import time rather than 200 KB of stream
 * machinery quietly shipped to every visitor.
 *
 * Checked through `globalThis` rather than a bare `window` so the check does not
 * depend on the DOM lib being in a consumer's `tsconfig` — a server-only package
 * should not need it.
 */
export function assertServerOnly(moduleName: string): void {
  if (typeof (globalThis as { window?: unknown }).window !== "undefined") {
    throw new Error(
      `@repo/observability/${moduleName} was imported into a browser bundle. ` +
        "This package is server-only: it depends on pino and its stream packages. " +
        "Import @repo/errors instead — it is isomorphic and has no dependencies.",
    );
  }
}
