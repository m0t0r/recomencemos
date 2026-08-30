"use server";

/**
 * Ending a session, as a Server Action — one per shell, because the two land in
 * different places and differ in nothing else.
 *
 * **They sit beside the menu that triggers them** rather than under each shell,
 * which is where `signOut` lived while `(site)` was the only caller. The menu
 * became shared when `/admin` got chrome of its own (#17), and its two actions
 * came with it: a component that takes an action as a prop and a caller that has
 * to construct a compatible one is a coupling nothing type-checks, and this is the
 * module where "compatible" is simply true.
 *
 * **The body is `lib/end-session.ts`, and both call it unchanged.** The
 * independent authorization, the revocation, the cookie clearing and the reason a
 * refusal for an anonymous caller is a redirect rather than an error are all
 * documented there — and are all things that must not exist twice.
 *
 * **`.stateAction()`, so the form works before hydration** (ADR-0015). The vendor's
 * own form guide marks `useAction` and `useStateAction` as not working without
 * JavaScript; `useActionState` over a real server-action reference is what lets
 * React emit the no-JS form encoding, and that is the whole mechanism behind
 * `no-script.tsx`.
 */

import { endSession } from "@/lib/end-session";
import { actionClient } from "@/lib/safe-action";

/**
 * Where a signed-out Worker lands. The Wall — public, and the one page that makes
 * sense to be on having just left.
 */
const SIGNED_OUT_PATH = "/";

/**
 * Where a signed-out Admin lands, and it is **not** the Wall.
 *
 * `/admin/sign-in` is the door they came through and the one they will come back
 * through; dropping them on the public product instead would answer "I have
 * finished moderating" with a different product entirely. It discloses nothing —
 * this path is only reachable by somebody who was authenticated a moment ago,
 * which is the difference between it and the link `forbidden.tsx` deliberately
 * does not offer.
 */
const ADMIN_SIGNED_OUT_PATH = "/admin/sign-in";

export const signOut = actionClient.stateAction(async () => endSession(SIGNED_OUT_PATH));

/**
 * **`actionClient` and not `adminActionClient`**, which is the one thing here
 * worth a second look. Every *other* action under `/admin` is built from the
 * client that refuses a caller who is not an authenticated Admin — but that gate
 * demands a `password_totp` session, and the two states this button most needs to
 * work in are the ones that do not have one: an Admin part-way through the door
 * holding a `password` session, and an Admin whose session has just expired.
 * Refusing _Salir_ to either would leave a person holding a session they are being
 * told they may not end.
 *
 * It is not a hole, because ending your own session is not an Admin capability —
 * `endSession` reads the caller's own session and revokes that one, so the worst
 * an anonymous caller achieves is a redirect. Nothing here is behind NFR14 because
 * nothing here acts on anybody else.
 */
export const signOutAdmin = actionClient.stateAction(async () => endSession(ADMIN_SIGNED_OUT_PATH));
