/**
 * The one type a query module accepts, and the reason it can be tested at all.
 *
 * **Every function in this package that reads or writes a row takes a handle as
 * its first parameter**, ahead of ADR-0010's principal. That is a decision taken
 * on [#12](https://github.com/m0t0r/recomencemos/issues/12) and it is the shape
 * every later query module copies — `./offers`, `./exchange`, `./moderation`,
 * `./export`.
 *
 * **Why a parameter rather than a swappable module singleton.** The obvious
 * alternative — query modules keep importing `db()` and a test substitutes the
 * PGlite instance behind it — keeps call sites shorter and puts hidden global
 * state under every one of them, so a test that forgets to substitute reaches
 * for a real database instead of failing. But the decisive argument is not that:
 * it is that NFR15 puts a row lock on the Hirer's Account *inside* `sendOffer`'s
 * transaction and NFR33 requires an `AdminAction` insert to share the
 * transaction of the action it records. Both mean a domain function has to be
 * callable inside a **caller's** transaction, which means accepting the
 * caller's handle. A swappable singleton would still need this shape for those
 * cases, and the package would carry two conventions instead of one.
 *
 * **`apps/web` cannot hold one of these, and that is not a gap.** ADR-0010
 * withholds `#connection`, so a Server Action has no handle to pass. Each public
 * subpath therefore exports its handle-taking functions *and* one bound object
 * beside them — see `rateLimit` in `./rate-limit`. The binding is one line per
 * function; the function it binds is the one seam 2 exercises.
 */

import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "#schema";

/**
 * Satisfied by **both** connections this repository runs against, which is the
 * whole point of naming it: `NodePgDatabase<typeof schema>` behind PgBouncer in
 * production, and `PgliteDatabase<typeof schema>` in seam 2. Those are different
 * types with no supertype either package names, so without this the seam-2 test
 * could not call the module it is testing and would have to assert on raw SQL —
 * the fixture drift `## Testing Decisions` exists to prevent.
 *
 * `PgQueryResultHKT` is the unparameterised query-result kind, which is what
 * makes one type cover both drivers. Verified rather than assumed: a probe
 * asserting assignability from each, plus `select`, `insert` and `transaction`
 * through this type, type-checks under the repo's TypeScript.
 */
export type DomainDatabase = PgDatabase<PgQueryResultHKT, typeof schema>;

/**
 * The handle a function is given **inside** `db.transaction(...)`, and the one
 * type that can say "this may only be called from within a transaction".
 *
 * **Derived from `DomainDatabase` rather than written out**, because
 * `PgTransaction`'s three type parameters would have to be spelled twice — once
 * here and once wherever the driver changes — and the callback's own parameter is
 * already exactly the type in question. Reading it back off the signature is what
 * keeps the two drivers seam 2 and production run on from needing separate
 * spellings.
 *
 * **The refusal it buys is structural.** A `PgTransaction` carries `rollback()`
 * and a plain `PgDatabase` does not, so passing a connection where this is asked
 * for is a type error rather than a review comment. `recordConsent` in `./consent`
 * is the first function that needs that: the criterion it satisfies is that a
 * Consent row is written in the same transaction as the collection it
 * authorizes, and a signature is the only place that can be enforced.
 */
export type DomainTransaction = Parameters<Parameters<DomainDatabase["transaction"]>[0]>[0];
