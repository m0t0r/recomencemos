/**
 * NFR14's gate, as a type rather than as a call somebody remembers to make.
 *
 * **The requirement is that authentication is a property of the *session*.** An
 * Account holding the Admin grant is not an authenticated Admin; a session that
 * presented a single-use emailed link **and** a code from the authenticator is.
 * A second factor recorded against the *Account* cannot express that — it stays
 * true while a magic-link session on the same Account presents no second factor
 * at all — so the two facts are read off the session row this package writes at
 * creation and off the `user` row the grant lives on, and both are checked here.
 *
 * **The check is a pure function over a session, and that is deliberate.** It
 * could have been a method on `AuthHandler` reading the headers itself, and that
 * would have put a database round trip inside a decision that has none to make:
 * `getSession` already returned everything the answer needs. Keeping it pure puts
 * NFR14's rule at seam 1, where a table of session shapes can drive it, rather
 * than at seam 2 where each case costs a real sign-in.
 */

import type { SignInMethod } from "#auth-schema";
import { ADMIN_SIGN_IN_METHOD } from "#auth-schema";

/**
 * What this module needs to know about a session. Structural, so
 * `AuthHandler.getSession`'s return type satisfies it without this module
 * importing the auth door — and so a test can pass a literal.
 */
export interface AdminCandidateSession {
  readonly accountId: string;
  readonly signInMethod: SignInMethod | string;
  readonly isAdmin: boolean;
}

/**
 * The brand, and the reason it is a `unique symbol` that is declared and never
 * exported.
 *
 * TypeScript's structural typing would otherwise let any `{ accountId }` stand in
 * for an authenticated Admin, which would make {@link AdminActor} a comment. With
 * the brand, the **only** way to obtain one of these is {@link requireAdminSession},
 * and `runAdminAction` takes one — so "every Admin mutation is behind NFR14's
 * check" is carried by the compiler rather than by review.
 *
 * `declare const` rather than a real symbol: it exists in the type system only,
 * so nothing is allocated and nothing crosses a boundary.
 */
declare const adminActor: unique symbol;

/**
 * An Admin, authenticated as NFR14 defines it. Carries the actor id the audit
 * record needs and nothing else — no email, no token, no session (NFR18).
 */
export interface AdminActor {
  readonly accountId: string;
  readonly [adminActor]: true;
}

/**
 * The gate. `null` for every caller that is not an authenticated Admin, and
 * deliberately **one** answer for all of them.
 *
 * Signed out, signed in as a Worker, an Admin who arrived by magic link, an Admin
 * who typed a password and no code — the same `null`, because NFR14 answers 403
 * to all of them for the same reason it answers 403 rather than redirecting:
 * _"a redirect tells an unauthenticated caller that the route exists and is worth
 * attacking"_. A richer return type here would let a surface leak which of the
 * four it was, one level below where that argument was made.
 *
 * **Both halves are required and neither implies the other.** The grant without
 * the method is the magic-link hole NFR14 exists to close. The method without the
 * grant cannot happen today — credential sign-up is closed — but it is checked
 * anyway, because "cannot happen today" is the wrong thing for the authority that
 * can read every phone number in the system to rest on.
 */
export function requireAdminSession(session: AdminCandidateSession | null): AdminActor | null {
  if (!session) return null;
  if (!session.isAdmin) return null;
  if (session.signInMethod !== ADMIN_SIGN_IN_METHOD) return null;

  return { accountId: session.accountId } as AdminActor;
}
