/**
 * The pure half of the sign-in flow: which door a path is, how long the session
 * it mints lives, and how a person's shared-device answer survives the round
 * trip between asking for a link and opening it.
 *
 * Everything here is a pure function over values, which is why it sits at seam 1
 * (`## Testing Decisions`). The impure half — the hooks that call these, and the
 * Better Auth options that install them — is `#auth/config`.
 */

import { AppError } from "@repo/errors/app-error";
import { ADMIN_SIGN_IN_METHOD, type SignInMethod, SIGN_IN_METHODS } from "#auth-schema";
import { SIGN_IN_FAILED } from "#user-messages";

/**
 * The Admin door's endpoint path — declared here rather than beside the endpoint
 * that serves it, and the placement is load-bearing rather than tidy.
 *
 * {@link SIGN_IN_PATHS} below is keyed by it, and `#auth/admin-door` is where the
 * endpoint is built. Declaring it there and importing it here made this module
 * depend on the endpoint, which depends on `#admin/door`, which depends on
 * `#auth/config`, which depends on this module — and an ESM cycle resolved in
 * that order evaluates this file while the constant is still in its temporal
 * dead zone. The map then keyed itself by the string `"undefined"` and
 * `signInMethodForPath` threw for the one door it had just been taught, which is
 * how this comment came to be written.
 *
 * Here it is a leaf. The endpoint imports its own path from the table that
 * decides what a session made through it is called, which is also the right way
 * round to read.
 */
export const ADMIN_SECOND_FACTOR_PATH = "/second-factor/verify";

/**
 * Every Better Auth path that mints a session in this product, mapped to the
 * value NFR14's `requireAdminSession` reads off the session row.
 *
 * **A path this table does not name mints no session.** `signInMethodForPath`
 * throws rather than defaulting, and `session.signInMethod` is `NOT NULL` with
 * no database default, so the failure is loud at both levels. That is the
 * correct direction to fail: NFR14 says an Admin session is one established
 * through an emailed link and a code, so a door that arrives without declaring
 * itself must not be able to produce a session that merely *looks* like one — and a default
 * of `"magic_link"` here would hand exactly that to the next door somebody adds.
 *
 * **Three paths for three methods, one door each.** There were five, because the
 * `twoFactor` plugin served `/two-factor/verify-totp` and
 * `/two-factor/verify-backup-code` and both collapsed onto one method — a backup
 * code *is* the second factor, and what matters is that two factors were
 * presented rather than which second one. That property did not go away with the
 * plugin; it moved into the one endpoint below, whose single `code` field takes
 * six digits or one printed code and tells them apart by shape.
 *
 * **`/sign-in/email` was here too, and it was never an Admin session.** It
 * existed for the window in which an Admin granted by a manual `UPDATE` had to
 * reach enrolment before a TOTP secret existed. Enrolment happens over the direct
 * connection now, before the grant is set at all, so there is no window and no
 * credential door to have one.
 *
 * **The last row is this product's own endpoint, and it is the only one.** The
 * other two belong to Better Auth; `/second-factor/verify` is
 * `#auth/admin-door`'s, and it is the sole producer of the one method NFR14
 * accepts. That is the whole of what makes "an Admin session presented two
 * factors" true — there is exactly one way to write the value, and it is behind
 * a live challenge from a single-use link plus a code from the authenticator.
 */
const SIGN_IN_PATHS: Readonly<Record<string, SignInMethod>> = {
  "/magic-link/verify": "magic_link",
  "/callback/:id": "google",
  [ADMIN_SECOND_FACTOR_PATH]: "link_totp",
};

/**
 * The two session lifetimes NFR13 fixes for a Worker, in seconds.
 *
 * **Own device 30 days, absolute.** NFR13 says "rolling", but
 * `disableSessionRefresh` in `#auth/config` refuses every refresh — the
 * mechanism that keeps a shared-device row honest keeps this one fixed too, so
 * a Worker who uses the product daily signs in again on day 30. The deviation
 * is argued at that option and asserted by
 * `session-lifetime.integration.test.ts`; amending NFR13's word is flagged on the
 * PR as a human's call.
 *
 * **Shared device 8 hours, and enforced here on the row.** DD5 is explicit that
 * the row is the half that matters: a cybercafé browser may not close for a
 * week, so a non-persistent cookie alone is a promise the device does not keep.
 * The cookie half ships too — see `#auth/config` — but this is the one that is
 * true even if the cookie half regresses.
 */
export const OWN_DEVICE_SESSION_SECONDS = 60 * 60 * 24 * 30;
export const SHARED_DEVICE_SESSION_SECONDS = 60 * 60 * 8;

/**
 * NFR13's third lifetime: **Admin 8 hours, no rolling** — and it is not the
 * shared-device number wearing a different name, even though the two happen to
 * be equal.
 *
 * They answer different questions and will drift the first time either is
 * revisited. The shared-device figure bounds how long a cybercafé browser stays
 * signed in; this one bounds how long an account that can take down a profile
 * and read every exchanged phone number stays signed in **on its owner's own
 * machine**. Collapsing them into one constant would make a change to either a
 * silent change to both.
 *
 * **It does not depend on the shared-device answer, and that is deliberate.** An
 * Admin ticking _"este no es mi teléfono"_ gets the same eight hours, because the
 * ceiling is already the shorter of the two — and an Admin who did not tick it
 * must not get thirty days. `sessionSecondsFor` therefore takes the method first
 * and the attempt second.
 *
 * The "no rolling" half is already true for every session here:
 * `disableSessionRefresh` in `#auth/config` refuses every refresh. The other way
 * round it was a trusted device, which would have re-established this session on
 * one factor for thirty days; the plugin that offered it is gone, so there is no
 * longer a field to strip or a caller to trust not to pass one.
 */
export const ADMIN_SESSION_SECONDS = 60 * 60 * 8;

/**
 * What one sign-in attempt carries from the moment she answers the
 * shared-device question to the moment a session row is written.
 *
 * Two fields for two different requirements, travelling together because they
 * cross the same gap: NFR13's lifetime, and NFR27's correlator.
 */
export interface SignInAttempt {
  /** Her answer to _"este no es mi teléfono"_. Defaults to the safe reading of silence. */
  readonly sharedDevice: boolean;
  /**
   * Minted per magic-link request; absent for the Google door, which NFR27 does
   * not measure because a Google sign-in never touches email.
   */
  readonly signInAttemptId?: string | undefined;
}

/**
 * The key the attempt is stashed under on Better Auth's endpoint context.
 *
 * A `hooks.before` handler returning `{ context: { ... } }` has that object
 * merged into the endpoint context, and `databaseHooks` are handed the merged
 * context — so this is Better Auth's own documented way to carry a value from a
 * middleware to a database hook, with no module-level mutable state and nothing
 * shared between concurrent requests.
 */
export const SIGN_IN_ATTEMPT_KEY = "recomencemosSignInAttempt";

/** What every unanswered case reduces to. Silence is read as the safer answer. */
export const NO_SIGN_IN_ATTEMPT: SignInAttempt = { sharedDevice: false };

/**
 * Which door this is.
 *
 * Throws for an unknown path — see {@link SIGN_IN_PATHS} for why that is the
 * design rather than a missing default.
 */
export function signInMethodForPath(path: string): SignInMethod {
  // `Object.hasOwn` rather than a bare lookup: a plain object literal inherits
  // `constructor`, `toString` and the rest, so `SIGN_IN_PATHS["constructor"]`
  // is truthy and would return a function where a method belongs. Not reachable
  // today — `path` is a route template from Better Auth's endpoint table, never
  // a string a caller supplies — but this is the field NFR14 gates Admin
  // authority on, and "not reachable today" is the wrong thing for that to rest
  // on.
  const method = Object.hasOwn(SIGN_IN_PATHS, path) ? SIGN_IN_PATHS[path] : undefined;
  if (method) return method;

  throw new AppError({
    code: "sign_in_method_unknown",
    status: 500,
    message:
      `A session was about to be created from "${path}", which is not one of this ` +
      `product's sign-in doors (${SIGN_IN_METHODS.join(", ")}). Admin authentication ` +
      "is a property of the session here, so a session whose method is unknown " +
      "must not be minted. Add the path to SIGN_IN_PATHS and the method to " +
      "SIGN_IN_METHODS and the session table's CHECK, together.",
    userMessage: SIGN_IN_FAILED,
    context: { path },
  });
}

/**
 * NFR13, as one number.
 *
 * **The method is consulted before the attempt**, so an Admin session is eight
 * hours whatever she answered to _"este no es mi teléfono"_. Reading the attempt
 * first would give an Admin who did not tick the box a thirty-day session, which
 * is the one lifetime NFR13 refuses that account outright.
 *
 * **It is the same comparison the refusal at session creation makes**, against
 * {@link ADMIN_SIGN_IN_METHOD} rather than against a list. There was a list here
 * — three members, two of them credential sessions from the door DD5's contract
 * half removed — and it is now the complement of one member for the reason that
 * rule is: a door added later gets the ordinary lifetime and is refused for an
 * Admin, rather than inheriting either by omission.
 */
export function sessionSecondsFor(method: SignInMethod, attempt: SignInAttempt): number {
  if (method === ADMIN_SIGN_IN_METHOD) return ADMIN_SESSION_SECONDS;
  return attempt.sharedDevice ? SHARED_DEVICE_SESSION_SECONDS : OWN_DEVICE_SESSION_SECONDS;
}

/** When a session minted now should expire. Takes the clock so seam 1 can fix it. */
export function sessionExpiryFor(method: SignInMethod, attempt: SignInAttempt, now: Date): Date {
  return new Date(now.getTime() + sessionSecondsFor(method, attempt) * 1000);
}

/**
 * Read the attempt back off whatever Better Auth hands the hook.
 *
 * Deliberately total: the context is `GenericEndpointContext | null` and the
 * merged key is `unknown` as far as the type system is concerned, so this
 * validates rather than casts and never throws.
 *
 * **It has two different answers for two different situations, and conflating
 * them is the mistake this comment exists to prevent.**
 *
 * - **No attempt carried at all** is an *answer*, not a failure: she did not
 *   tick _"este no es mi teléfono"_, which is the overwhelmingly common case and
 *   the one NFR13 gives 30 rolling days. Reading it as shared would put every
 *   Worker on an 8-hour session and take away the thing story 1 is for —
 *   reaching her account from her phone without remembering anything.
 * - **An attempt carried whose flag is unreadable** is a *bug* in our own hook,
 *   and there the safe direction is the other one. A lost answer must cost her
 *   the shorter session, never the longer one, because the longer one is a
 *   30-day session left open on a cybercafé machine.
 *
 * So the rule is: absent → own device; present and not explicitly `false` →
 * shared.
 */
export function readSignInAttempt(context: unknown): SignInAttempt {
  if (typeof context !== "object" || context === null) return NO_SIGN_IN_ATTEMPT;

  const carried = (context as Record<string, unknown>)[SIGN_IN_ATTEMPT_KEY];
  if (typeof carried !== "object" || carried === null) return NO_SIGN_IN_ATTEMPT;

  const { sharedDevice, signInAttemptId } = carried as Record<string, unknown>;

  return {
    // Anything that is not an explicit `false` is read as shared. See above.
    sharedDevice: sharedDevice !== false,
    signInAttemptId:
      typeof signInAttemptId === "string" && signInAttemptId ? signInAttemptId : undefined,
  };
}

/**
 * The header the shared-device answer travels on for the **Google** door, and
 * the reason it is a header rather than the verification row the magic link
 * uses.
 *
 * `/sign-in/social`'s request body is a closed Zod schema that strips unknown
 * keys, so there is no field to put this in. A header is the one channel that
 * survives that.
 *
 * **The browser no longer sets it, and that is the whole change.** It used to:
 * the Google door was a `better-auth/react` call from a Client Component, which
 * made this spelling a wire contract `apps/web` had to pin with a test of its
 * own. `startGoogleSignIn` in `#auth/index` sets it now, on a request this
 * package makes to itself, so it is internal to the hop between that function
 * and the `before` middleware in `#auth/config` — and it is not exported.
 *
 * It is not a security boundary and does not need to be: the only thing a forged
 * value could change is how long **her own** session lasts, and she can already
 * change that by not ticking the box.
 */
export const SHARED_DEVICE_HEADER = "x-recomencemos-shared-device";

/**
 * The cookie that carries the answer across the Google round trip.
 *
 * The magic link cannot use a cookie — she may open it in a mail app's webview
 * with none of the cookies `/sign-in` set — which is why DD5 puts that door's
 * answer on the verification row. The OAuth flow has the opposite property: the
 * provider redirects back to **the same browser**, which is the assumption
 * Better Auth's own state cookie already rests on. So the cheaper carrier is
 * correct here and the more expensive one is correct there.
 *
 * Ten minutes matches Better Auth's own OAuth state expiry, so a stale answer
 * cannot outlive the flow it belongs to.
 */
export const SHARED_DEVICE_COOKIE = "recomencemos.shared_device";
export const SHARED_DEVICE_COOKIE_MAX_AGE_SECONDS = 600;

/** Reads the header the client sets. Absent, malformed or `"0"` all mean "own device". */
export function sharedDeviceFromHeader(value: string | null | undefined): boolean {
  return value === "1" || value === "true";
}
