"use server";

/**
 * The two doors, as two Server Actions.
 *
 * **Both authorize independently**, which for this surface means something worth
 * stating rather than skipping: it is public, so there is no principal to check —
 * and the reason the API contract still says *every* Server Action authorizes
 * independently is that Next compiles each one to a directly reachable POST
 * endpoint, so a page-level check never extends to it. What these owe instead of
 * a principal check is everything the client does for them: `actionClient`
 * validates the input, charges the ceiling, and `@repo/domain` validates
 * `returnPath` itself rather than trusting the page that rendered the form.
 *
 * **Both are `.stateAction()`, and that is what keeps NFR4 reachable.**
 * next-safe-action's own form guide marks `useAction` and `useStateAction` as
 * not working without JavaScript and `useActionState` as the one that does; a
 * `.stateAction()` is a real server-action reference, so React can still emit
 * the no-JS form encoding. See the note in `lib/safe-action.ts`.
 *
 * **Neither takes a hidden input.** `returnPath` and `sharedDevice` arrive as
 * bound arguments — see `bindArgsSchemas` below and `_lib/schema.ts` for why.
 */

import { MAGIC_LINK_TTL_MINUTES } from "@repo/domain/auth-handler";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "../../../lib/auth";
import { actionClient, rateLimit, returnActionError } from "../../../lib/safe-action";
import { checkYourEmail } from "./_lib/messages";
import {
  requestMagicLinkSchema,
  returnPathArg,
  sharedDeviceArg,
  type RequestMagicLinkInput,
} from "./_lib/schema";

/**
 * What the form gets back on success.
 *
 * **It is `{ sent: true }` whatever happened to the address**, which is the API
 * contract's word and the reason this endpoint cannot enumerate: an address that
 * has an Account and one that does not produce the same reply, the same timing
 * class, and the same sentence on screen. "Revisa tu correo" is said either way,
 * because the honest reply and the enumeration-safe reply are the same one.
 *
 * A failure is not modelled here at all — it is `result.serverError`, built by
 * the one bridge in `lib/safe-action.ts`, so a refusal and a transport fault
 * cannot be spelled two different ways by two different actions.
 */
export interface MagicLinkSent {
  readonly sent: true;
  readonly message: string;
}

export const requestMagicLink = actionClient
  .bindArgsSchemas([returnPathArg, sharedDeviceArg])
  .inputSchema(requestMagicLinkSchema)
  /**
   * `useValidated`, not `use`, and the reason is NFR26's own sentence: the
   * address principal does not exist until the input has been parsed. Charging
   * before the parse would let a malformed address spend her hourly budget, and
   * the ceiling's whole purpose is to bound real sends.
   */
  .useValidated(
    rateLimit<RequestMagicLinkInput>({
      action: "requestMagicLink",
      /**
       * Both halves of NFR26 — _"≤ 5/hour per address **and** ≤ 20/hour per
       * IP"_ — because either alone leaves the obvious way round: an
       * address-only bound is defeated by rotating addresses, and an IP-only
       * bound is defeated by mobile data while tripping on a shared NAT. The
       * `ip` scope needs no selector; the middleware reads the headers itself.
       */
      principals: [{ scope: "address", id: (input) => input.email }, { scope: "ip" }],
    }),
  )
  .stateAction<MagicLinkSent>(
    async ({ parsedInput: { email }, bindArgsParsedInputs: [returnPath, sharedDevice] }) => {
      const outcome = await auth().requestMagicLink({
        email,
        sharedDevice,
        returnPath,
        headers: await headers(),
      });

      if (!outcome.ok) {
        // Returned, not thrown, so it costs one `warn` line and no Sentry event —
        // CLAUDE.md's "thrown is reported; returned is logged". She still gets a
        // real sentence and her address stays in the field.
        return returnActionError(outcome.error.toClientError());
      }

      return { sent: true, message: checkYourEmail(MAGIC_LINK_TTL_MINUTES) };
    },
  );

/**
 * The Google door, which is a Server Action rather than a browser call.
 *
 * **Nothing about this runs in the browser any more.** It was
 * `createAuthClient().signIn.social(...)` from a Client Component; moving it here
 * took `better-auth/react` — and `@better-fetch/fetch`, `nanostores` and `defu`
 * with it — out of the client graph entirely, and it made the door work with no
 * JavaScript, which it previously did not.
 *
 * **The cookies are the half that must not be dropped.** Better Auth writes its
 * OAuth `state` cookie, and `@repo/domain` writes the shared-device cookie
 * beside it, onto the response of a call this action makes internally — they do
 * not reach the browser on their own. `startGoogleSignIn` hands them back and
 * this action writes them onto its own response. Skipping that produces a
 * `state_mismatch` at the provider's callback.
 *
 * **There is no ceiling on this door and that is deliberate**, not an omission:
 * NFR26 bounds `requestMagicLink` because it *sends mail on someone else's
 * behalf*. Starting an OAuth redirect sends nothing, creates nothing, and costs
 * this system one row-less round trip. The ceilings that do apply to Google land
 * with the session-creating callback, which is Better Auth's own limiter.
 */
export const startGoogleSignIn = actionClient
  .bindArgsSchemas([returnPathArg, sharedDeviceArg])
  .stateAction(async ({ bindArgsParsedInputs: [returnPath, sharedDevice] }) => {
    const outcome = await auth().startGoogleSignIn({
      sharedDevice,
      returnPath,
      headers: await headers(),
    });

    if (!outcome.ok) {
      return returnActionError(outcome.error.toClientError());
    }

    const cookieStore = await cookies();

    for (const setCookie of outcome.setCookie) {
      const [pair] = setCookie.split(";");
      const separator = pair?.indexOf("=") ?? -1;
      if (!pair || separator < 1) continue;

      /**
       * Parsed rather than passed through, because `cookies()` takes a name and
       * a value and not a `Set-Cookie` line. The attributes Better Auth set —
       * `httpOnly`, `sameSite`, `maxAge`, `secure` — are re-derived from the
       * line so the cookie this action writes is the cookie the callback
       * expects; `state` is the one that has to survive verbatim.
       */
      cookieStore.set({
        name: pair.slice(0, separator),
        value: pair.slice(separator + 1),
        httpOnly: /;\s*httponly/i.test(setCookie),
        secure: /;\s*secure/i.test(setCookie),
        sameSite: /;\s*samesite=strict/i.test(setCookie)
          ? "strict"
          : /;\s*samesite=none/i.test(setCookie)
            ? "none"
            : "lax",
        path: /;\s*path=([^;]+)/i.exec(setCookie)?.[1]?.trim() ?? "/",
        ...(() => {
          const maxAge = /;\s*max-age=(-?\d+)/i.exec(setCookie)?.[1];
          return maxAge === undefined ? {} : { maxAge: Number(maxAge) };
        })(),
      });
    }

    /**
     * `redirect` throws a framework error, which next-safe-action re-throws
     * rather than routing through `handleServerError` — so this is a navigation
     * and not a swallowed failure. Nothing after it runs.
     */
    redirect(outcome.url);
  });
