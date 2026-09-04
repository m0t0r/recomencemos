/**
 * `/sign-in` — the two doors into an Account.
 *
 * Shaped at `.impeccable/briefs/sign-in.md`; the state set and the target path
 * are the spec's (`## UX design`). Mode is **Operate**: nobody wants to spend
 * time here, so scanability and familiar affordances outrank expression, and the
 * brand lives in the precision of the details.
 *
 * The layout was chosen by `/prototype` UI — three variants on this real route
 * with the real Server Action behind them. The losing two and the `?variant=`
 * switcher live on `prototype/12-sign-in-variants`; `sign-in-form.tsx` carries
 * the winner and the argument for it.
 *
 * **`noindex`.** This surface has nothing a crawler should hold. NFR8's
 * table-driven check over the whole gated route list is story 5/8's; this is the
 * one row #12 owns.
 */

import { safeReturnPath } from "@repo/domain/auth-handler";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, googleSignInAvailable } from "@/lib/auth";
import { SignInForm } from "./_components/sign-in-form";

export const metadata: Metadata = {
  title: "Entrar — Recomencemos",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

/**
 * **`[block]` from Cache Components' own menu, and #125 is what moved it there.**
 * It was `[stream]`, on the argument that nothing on this page needs to wait for
 * the query string before it can paint — which was right while the query string
 * was the only dynamic thing here.
 *
 * The session read is not like it. A streamed shell is a **200 already on the
 * wire** by the time that read answers, so the only redirect left to Next is a
 * `<meta http-equiv="refresh" content="1;url=/">` written into the flushed
 * document — measured at seam 3, not predicted. A person holding a live session
 * therefore sat looking at a skeleton of the door they had already come through
 * for a full second before the browser moved them. Blocking makes it a real
 * `307` before anything is on the wire, which is what the brief's `signed_in`
 * state asks for: redirected rather than shown the form.
 *
 * **What it costs is measured, and it is one query.** What is given up is the
 * static shell for the signed-out case, which is the common one — so the first
 * paint is now the real form rather than a card-shaped skeleton one round trip
 * sooner. On the slow connection NFR5 is about, the network is what dominates
 * either way; a second spent looking at a door already come through is not.
 * The seam-3 numbers are on the pull request.
 */
export const instant = false;

/**
 * The gate, then the doors.
 *
 * **The session read sits here and not inside a boundary**, which is the half
 * `instant = false` alone does not buy. A `redirect()` thrown inside a
 * `<Suspense>` reaches a browser as a `<meta http-equiv="refresh">` in an
 * already-flushed document, because the boundary streams whatever the segment
 * config says; thrown from the page body it is a `307` with no body at all.
 *
 * **The panel and its skeleton went with the change, and their absence is the
 * consequence rather than a tidy-up.** They existed to stream `searchParams`
 * behind a card-shaped fallback. Once the page waits for a session before it
 * writes anything, that fallback can never render — the query string has
 * resolved long before the gate has — and a fallback that cannot render is
 * scaffolding a later reader has to disprove.
 */
export default async function SignInPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;

  const returnPathParam = params.returnPath;
  const errorParam = params.error;

  /**
   * **A live session is sent onward rather than shown the form** (the brief's
   * `signed_in` state, amended in with #96). It is a redirect and not a message
   * because there is nothing to tell somebody about a problem they do not have.
   *
   * **Every session alike, and that is the load-bearing half.** An Admin session
   * is *not* sent to `/admin`: this page has no business knowing what kind of
   * session it turned away, and a redirect that differed by grant would make
   * this public form an oracle for which Accounts hold one — reachable by anyone
   * holding a cookie, on the surface whose whole design is that the Admin's door
   * looks like everybody else's.
   *
   * The target is `safeReturnPath`'s answer rather than a second rule. It
   * *coerces* rather than refuses, so an unsafe `?returnPath=` lands on `/`
   * instead of erroring — which is right here, where the person did nothing
   * wrong and there is nothing to report.
   */
  if (await auth().getSession(await headers())) {
    redirect(safeReturnPath(typeof returnPathParam === "string" ? returnPathParam : undefined));
  }

  return (
    <SignInForm
      googleAvailable={googleSignInAvailable()}
      /*
        Passed through as she sent it and validated **server-side**, never here:
        this becomes a bound argument on both actions, and a check performed at
        render is a check an attacker posts straight past.

        **The two doors are guarded by two different things**, which is worth
        knowing before trusting either. Both now run server-side, and both reach
        `safeReturnPath` in `@repo/domain` — which *coerces* anything unsafe to
        `/` — but the Google door then hands the coerced value to Better Auth as
        `callbackURL`, where its own relative-path check applies:
        `/^\/(?!\/|\\|%2f|%5c)[\w\-.\+\/@]*…$/`, read out of
        `matchesOriginPattern` at 1.7.1, which *refuses* with 403
        INVALID_CALLBACK_URL rather than coercing.

        Both are closed. They are not the same guard and they do not accept the
        same set: a path `safeReturnPath` allows through can still 403 on the
        Google door, because its character class is narrower than ours.
      */
      returnPath={typeof returnPathParam === "string" ? returnPathParam : "/"}
      error={typeof errorParam === "string" ? errorParam : undefined}
    />
  );
}
