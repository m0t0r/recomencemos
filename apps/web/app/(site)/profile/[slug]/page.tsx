/**
 * `/profile/[slug]` — one Worker's full profile, behind an Account.
 *
 * The state set is the spec's `## UX design`, the **Full profile** row, plus the
 * seventh state every ceilinged surface carries. Four of its cells are decided
 * before anything worth reading is rendered, and the order they are decided in
 * is the design:
 *
 * 1. **Signed out → `/sign-in` with a way back.** `requireAccountPage` encodes
 *    the return path and `safeReturnPath` in `@repo/domain` reduces it again on
 *    arrival, so the open redirect this parameter invites is refused at the end
 *    that consumes it rather than at the end that mints it — and the slug check
 *    below means the only thing this end ever mints is `/profile/` plus sixteen
 *    characters of `[a-z2-7]`. A redirect rather than a 403, because there is
 *    nothing to tell somebody about a problem they can fix by entering.
 * 2. **The ceiling is charged next, before the caller's own state is read.** A
 *    frozen caller is charged exactly as anyone else is; charging after the
 *    freeze check would let him measure his own state by never being rate
 *    limited.
 * 3. **Frozen → the missing-profile response, and it is one call after the same
 *    work.** `notFound()` for a caller who may not read and for a slug that
 *    names nothing, so "indistinguishable" is a property of there being one code
 *    path rather than of two paths agreeing about a document (C22). Both reads
 *    run whatever either says — see below for the 42 bytes that bought.
 * 4. **Blocked → served normally.** C3 narrowed a Block to the send, so there is
 *    no Block check here and there is not meant to be one. The send is where he
 *    is refused.
 *
 * **Every refusal on this route is returned, never thrown** (NFR26's second
 * half, C51). `notFound()` is a framework interrupt of the same class as
 * `redirect()` and `/admin`'s `forbidden()` — it costs no Sentry event — and the
 * ceiling's refusal is a value this page renders. Profile enumeration is
 * otherwise the cheapest path there is to the month's 5,000-event allowance.
 *
 * **`noindex`, both halves.** `/profile` has been on `GATED_ROUTE_PREFIXES`
 * since #12, so `next.config.ts` already sends `X-Robots-Tag` for it; this sets
 * the `<meta>`. NFR9 is what makes the bare slug harmless in a referrer, and
 * this page keeps it that way: nothing in the metadata names her.
 *
 * **Nothing is cached** (DD1), and the one line this route can emit carries
 * nothing of hers. The two reads return `about` and her work history, which
 * NFR18 allows on **0** log lines, so the page makes no `logger` call at all —
 * the single line it can produce is the ceiling refusal's `warn`, written by
 * `lib/ceilings.ts`, whose `context` is a ceiling name, a count and a wait.
 */

import { Skeleton } from "@repo/design-system/components/skeleton";
import { accounts } from "@repo/domain/accounts";
import { mayReadGatedProfile } from "@repo/domain/policy";
import { profiles, SLUG_PATTERN } from "@repo/domain/profiles";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireAccountPage } from "@/lib/account";
import { type CeilingRefusal, chargeCeilings } from "@/lib/ceilings";
import { clientIp } from "@/lib/client-ip";
import { GatedProfileView } from "./_components/gated-profile-view";
import { ReadPaused } from "./_components/read-paused";
import { PROFILE_PAGE_TITLE } from "./_lib/messages";

export const metadata: Metadata = {
  title: PROFILE_PAGE_TITLE,
  robots: { index: false, follow: false },
};

type Params = Promise<{ readonly slug: string }>;

/**
 * NFR26's two windows against this Account and this address — four counters,
 * charged through `lib/ceilings.ts` so the refusal's `warn` line cannot be left
 * out of the page that returns it.
 *
 * **The prefetch question was asked and answered rather than assumed.** Every
 * row on the two public lists is now a `<Link>`, which prefetches by default, so
 * scrolling `/profiles` could in principle have spent a reader's whole hourly
 * allowance without her opening anything. It does not: under Cache Components a
 * prefetch fetches the **static shell**, and this charge sits inside the dynamic
 * boundary. Measured at seam 3 — the full 24-row list scrolled end to end
 * charged **0**.
 */
async function chargeReadCeilings(accountId: string): Promise<CeilingRefusal | undefined> {
  const ip = clientIp(await headers());

  return chargeCeilings(
    [
      { scope: "account", id: accountId },
      { scope: "ip", id: ip },
    ],
    ["readProfileHourly", "readProfileDaily"],
  );
}

async function ProfilePanel({ params }: { readonly params: Params }) {
  const { slug } = await params;

  /**
   * The slug is checked against the minter's own pattern **first**, before the
   * session, the ceiling or a query. Three things follow, and the third is the
   * reason it is first rather than merely early:
   *
   * - A hand-typed path cannot spend an allowance, and `/profile/<anything>` is
   *   the cheapest thing on the internet to generate.
   * - The answer is the same 404 an unknown slug gets, so nothing about the
   *   shape of a path distinguishes "malformed" from "nobody".
   * - **The return path below is built from this segment**, and checking here
   *   means the only string that can reach it is sixteen characters of
   *   `[a-z2-7]`. `safeReturnPath` reduces it again at the end that consumes it,
   *   which is where the guarantee has to live; this narrows what it is ever
   *   handed.
   */
  if (!SLUG_PATTERN.test(slug)) notFound();

  /**
   * **The redirect is a `<meta http-equiv="refresh">`, not a 307, and that is
   * measured rather than assumed** — the same finding `sign-in/page.tsx` records
   * from the other side. A `redirect()` from inside a streamed segment cannot
   * set a status: the shell is a 200 already on the wire by the time the session
   * read answers, so Next writes the meta refresh into the flushed document and
   * the browser moves a second later. It therefore works with JavaScript
   * unavailable, which is the property worth checking.
   *
   * `export const instant = false` would give a real 307 and was not taken, for
   * the reason that page sets out at length: the route stops being prerendered,
   * so `pnpm page-weight` can no longer measure it at all. NFR4 binds stories 2,
   * 4 and 24 and not this one, and the cost here is one second on an arrival
   * that ends at `/sign-in` either way.
   */
  const session = await requireAccountPage(`/profile/${slug}`);

  const paused = await chargeReadCeilings(session.accountId);
  if (paused) return <ReadPaused explanation={paused.userMessage} />;

  /**
   * **Both reads happen, whatever either says, and the refusal is one call at
   * one point.** That is what C22's "exactly the missing-profile response"
   * costs, and it was measured rather than assumed: with the freeze checked
   * first and `notFound()` called before the profile query, the two documents
   * came back **42 bytes apart** — the shorter path emitted one fewer streaming
   * chunk — so a frozen caller could tell "I am frozen" from "she is not here"
   * by reading `Content-Length`. Doing the same work on both paths closes the
   * length signal.
   *
   * **It does not close the timing one, and this comment used to say it did.**
   * Both reads run, but an index hit and a miss are not equal-time, and nothing
   * here measured them. What the equal work buys is that the *difference* is a
   * property of the data rather than of the branch — which is a smaller claim
   * than the one that was written, and the only one that was checked.
   *
   * The cost is one query a frozen caller's answer does not use, bounded by the
   * ceiling above. Nothing read here reaches him: the refusal is taken before
   * anything is rendered.
   *
   * His state is read from the **row** rather than from the session: a cookie
   * minted before a Report was filed would still say `active`, and a freeze a
   * stale session could outlive is not a freeze.
   */
  const [sendingState, profile] = await Promise.all([
    accounts.offerSendingState(session.accountId),
    profiles.findGated(slug),
  ]);

  if (!profile || !mayReadGatedProfile(sendingState)) notFound();

  /**
   * **Not awaited**, which is the whole of the streaming criterion: the promise
   * is handed to the view, a `<Suspense>` inside it suspends on it, and her
   * identity paints on the first flush. `await` here would make that boundary
   * decorative.
   */
  const workHistory = profiles.gatedWorkHistory(slug);

  return <GatedProfileView profile={profile} workHistory={workHistory} />;
}

/**
 * The fallback for the page's own boundary — the whole panel, since the session
 * read is the first thing that suspends and nothing above it depends on the
 * profile. Held at the shape the content takes so the header does not jump when
 * it resolves.
 */
function PanelSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-hidden="true">
      <div className="flex gap-4">
        <Skeleton className="size-12 shrink-0 rounded-full" />
        <div className="flex w-full flex-col gap-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-5 w-40" />
        </div>
      </div>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-28 w-full" />
    </div>
  );
}

export default function ProfilePage({ params }: { readonly params: Params }) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10">
      <Suspense fallback={<PanelSkeleton />}>
        <ProfilePanel params={params} />
      </Suspense>
    </main>
  );
}
