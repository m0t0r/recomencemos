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

import type { Metadata } from "next";
import { Suspense } from "react";
import { googleSignInAvailable } from "../../lib/auth";
import { SignInForm } from "./sign-in-form";

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

  return (
    <SignInForm
      googleAvailable={googleSignInAvailable()}
      /*
        Passed through as she sent it and validated **server-side** in the
        action, never here: this renders into a hidden field, and a check
        performed at render is a check an attacker posts straight past.
        `safeReturnPath` in `@repo/domain` is the one that counts.
      */
      returnPath={typeof returnPathParam === "string" ? returnPathParam : "/"}
      error={typeof errorParam === "string" ? errorParam : undefined}
    />
  );
}

/**
 * The fallback holds the card's shape rather than showing a spinner, so nothing
 * moves when the panel resolves. A fallback of a different shape than the
 * content it replaces is a layout shift you just specified.
 */
function PanelSkeleton() {
  return (
    <main
      className="bg-muted flex min-h-svh flex-col items-center justify-center px-4 py-12"
      aria-hidden="true"
    >
      <div className="bg-card border-border flex w-full max-w-md flex-col gap-6 rounded-lg border p-6 sm:p-8">
        <div className="bg-muted h-8 w-2/3 animate-pulse rounded" />
        <div className="bg-muted h-12 w-full animate-pulse rounded-md" />
        <div className="bg-muted h-4 w-3/4 animate-pulse rounded" />
        <div className="bg-muted h-28 w-full animate-pulse rounded-md" />
        <div className="bg-muted h-12 w-full animate-pulse rounded-md" />
      </div>
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
