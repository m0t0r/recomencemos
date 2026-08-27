/**
 * The proof that `@repo/domain`'s `exports` map actually withholds what it says
 * it withholds.
 *
 * [ADR-0010](../../docs/adr/0010-the-domain-package-is-the-only-door-to-the-database.md)
 * rests one architectural claim on a `package.json` field: _"an unexported
 * subpath is unresolvable under pnpm's isolated store, so reaching past the
 * domain layer is a module-resolution error rather than a review comment
 * somebody has to notice."_ A claim that strong should not be checked by reading
 * the manifest.
 *
 * **Node's resolver, not Vite's.** `createRequire(...).resolve` is the same
 * algorithm `next build` and the running server use, so a pass here is a
 * statement about the app rather than about the test runner's configuration. It
 * also answers at resolution time, which is what lets a withheld subpath be
 * asserted without importing a module that opens a database connection.
 *
 * **Both directions.** A test that only proved the failures would pass just as
 * happily if `@repo/domain` were not installed at all.
 */

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/**
 * Everything the domain must never publish. The list only ever gets longer.
 *
 * **#12 added the Better Auth entries**, and they are the reason
 * `## Modules and workspaces` says the Better Auth instance is unreachable from
 * `apps/web`: the app holds the three-method `AuthHandler` that
 * `@repo/domain/auth-handler` returns, and nothing else. `auth-schema` is
 * withheld for the same reason `schema` is — those are Better Auth's tables, and
 * a table is still a table.
 */
const WITHHELD = [
  // The package root itself: there is no `"."` entry in the map, so `import
  // "@repo/domain"` is not a shortcut past the subpaths either.
  "@repo/domain",
  "@repo/domain/schema",
  "@repo/domain/auth-schema",
  "@repo/domain/connection",
  "@repo/domain/config",
  "@repo/domain/database",
  // The configuration that *builds* the instance, which would hand a caller the
  // options object and with it every hook and credential in it.
  "@repo/domain/auth/config",
  "@repo/domain/auth/sign-in-attempt",
];

/** What the app is allowed to reach, and therefore what it must actually reach. */
const PUBLISHED = [
  "@repo/domain/health",
  "@repo/domain/migrate",
  // #12's two.
  "@repo/domain/auth-handler",
  "@repo/domain/rate-limit",
];

describe("the domain package's export map", () => {
  it.each(WITHHELD)("refuses %s to apps/web", (specifier) => {
    expect(() => require.resolve(specifier)).toThrow(
      expect.objectContaining({ code: "ERR_PACKAGE_PATH_NOT_EXPORTED" }),
    );
  });

  it.each(PUBLISHED)("resolves %s, so the refusals above mean something", (specifier) => {
    expect(require.resolve(specifier)).toContain("packages/domain");
  });
});
