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

import { Card } from "@repo/design-system/components/card";
import { Skeleton } from "@repo/design-system/components/skeleton";
import { safeReturnPath } from "@repo/domain/auth-handler";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth, googleSignInAvailable } from "@/lib/auth";
import { SignInForm } from "./_components/sign-in-form";

export const metadata: Metadata = {
  title: "Entrar — Recomencemos",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

/**
 * Split out because it reads `searchParams`.
 *
 * Cache Components makes data dynamic by default and fails the build on uncached
 * data outside a `<Suspense>` boundary. `searchParams` is exactly that, so the
 * boundary is `[stream]` from the framework's own menu — chosen rather than
 * `[block]`, because nothing on this page needs to wait for the query string
 * before it can paint.
 */
async function SignInPanel({ searchParams }: { searchParams: SearchParams }) {
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
   *
   * **It stays inside this boundary, and what that costs is measured rather than
   * assumed.** A `redirect()` thrown from a streamed segment cannot be a `307` —
   * the shell is a 200 already on the wire — so Next writes
   * `<meta http-equiv="refresh" content="1;url=…">` into the flushed document
   * and the browser moves a second later. Observed at seam 3, not predicted.
   *
   * `export const instant = false` with the gate above this boundary *does* give
   * a real `307`, and it was built, measured and reverted. It costs two things
   * that are worth more than the second: the route stops being prerendered, so
   * **`pnpm page-weight` can no longer measure it at all** — it exits `2`, and
   * `/sign-in`'s 298 KB is a figure `README.md` carries and NFR3's leading
   * indicator is checked with — and every signed-out visitor, who is nearly all
   * of them and is the Worker on a slow phone, waits a session query before
   * anything paints. What the second costs is a wordless skeleton on a rare
   * arrival. Reversing that judgement is one `export const instant = false` and
   * moving these lines above the `<Suspense>`.
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

/**
 * The fallback holds the card's shape rather than showing a spinner, so nothing
 * moves when the panel resolves. The wrappers are the same `main` classes and
 * the same `Card` the form renders, so the two cannot drift apart in outline.
 */
function PanelSkeleton() {
  return (
    <main
      className="bg-muted flex grow flex-col items-center justify-center px-4 py-12"
      aria-hidden="true"
    >
      <Card className="flex w-full max-w-md flex-col gap-6 p-6 sm:p-8">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-9 w-full" />
      </Card>
    </main>
  );
}

export default function SignInPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<PanelSkeleton />}>
      <SignInPanel searchParams={searchParams} />
    </Suspense>
  );
}
