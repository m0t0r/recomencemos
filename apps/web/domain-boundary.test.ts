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
  /**
   * **#17's, and the important one on this list.** `@repo/domain/admin` publishes
   * `runAdminAction` and `requireAdminSession`; it publishes the *handlers* to
   * nobody. That is NFR33's whole mechanism — the `AdminAction` insert lives in the
   * executor, so an Admin mutation that skipped the audit would have to reach a
   * handler, and this is what says it cannot. `names` is withheld beside it because
   * a subpath published for convenience is one more door to keep shut.
   */
  "@repo/domain/admin/handlers",
  "@repo/domain/admin/names",
  "@repo/domain/admin/actor",
  /**
   * **#14's, and the one that is not a credential.** `@repo/domain/consent`
   * publishes `hasConsented` and the version registry; `recordConsent` is
   * reachable only with a transaction handle, which `apps/web` cannot obtain
   * because `#connection` and `#database` are withheld above. The registry itself
   * is withheld here for the reason `admin/names` is — a subpath published for
   * convenience is one more door to keep shut, and everything it holds is
   * re-exported from `./consent` anyway.
   */
  "@repo/domain/consent/registry",
  /**
   * **The Admin's second factor, as values.** It generates a TOTP secret and ten
   * backup codes and decrypts both, so there is no version of `apps/web` that has
   * any business reaching it — the browser-facing half of that flow is one render
   * of values the domain hands over, and the checking half never leaves the
   * server. A subpath published for convenience is one more door to keep shut.
   */
  "@repo/domain/admin/second-factor",
  /**
   * **Everything that can grant Admin, from the side it must never be reachable
   * from.** `@repo/domain/admin-enrolment` is a barrel publishing the read the
   * enrolment screen makes and nothing else; the two functions that mint a setup
   * link and set `isAdmin` live in `admin/enrolment`, which is here — and the
   * command that drives them in `admin/enrol-cli`, also here.
   *
   * **`admin/enrolment` is on this list because the barrel is the mechanism.**
   * Publishing that module directly would resolve `mintAdminEnrolment` and
   * `completeAdminEnrolment` to `apps/web` too; that they could not be *called*
   * without a handle `#connection` withholds is true, and is a different
   * mechanism. ADR-0010's is withholding, and a map that publishes more than the
   * comment beside it claims is the shape a later reader trusts wrongly.
   *
   * DD5 makes the grant a thing a person does over the direct connection from a
   * shell — _"undocumented, it becomes a self-grant endpoint the first time
   * someone needs it at 2 a.m."_ — and this is one of the two mechanisms saying
   * so, the other being `isAdmin` declared `input: false`.
   */
  "@repo/domain/admin/enrolment",
  "@repo/domain/admin/enrol-cli",
  "@repo/domain/profiles/slug",
  "@repo/domain/policy/cities",
];

/** What the app is allowed to reach, and therefore what it must actually reach. */
const PUBLISHED = [
  "@repo/domain/health",
  "@repo/domain/migrate",
  // #12's two.
  "@repo/domain/auth-handler",
  "@repo/domain/rate-limit",
  // #17's one door onto the Admin's actions.
  "@repo/domain/admin",
  // #14's two: the Consent row, and the subject-access export it has to appear in.
  "@repo/domain/consent",
  "@repo/domain/export",
  // The enrolment screen's one read. It renders three credentials and grants
  // nothing; the granting half is in `WITHHELD` above.
  "@repo/domain/admin-enrolment",
  // #15's reads over the closed Skill vocabulary. The seed is a migration, so
  // this subpath publishes no way to write one.
  "@repo/domain/skills",
  // #16's three: the pure rules, the counted projections, and the aggregate
  // that publishes a profile and reads one's own.
  "@repo/domain/policy",
  "@repo/domain/projections",
  "@repo/domain/profiles",
  // #23's one: whether an Account may send an Offer, which is what decides
  // whether it is served a gated profile. A different aggregate from the
  // profile, and a Hirer may hold no profile at all.
  "@repo/domain/accounts",
  // #26's one: reading an exchange as one of its two parties, and recording
  // where a copy went. Writing one is `acceptOffer`'s, inside its transaction.
  "@repo/domain/exchange",
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
