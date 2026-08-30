/**
 * The shell — one strip of chrome above every page, in either group.
 *
 * Shaped at `.impeccable/briefs/site-header.md`; ticket
 * [#80](https://github.com/m0t0r/recomencemos/issues/80). Mode is **Operate**, and
 * it is chrome rather than a destination: it answers three questions a signed-in
 * person could not ask anywhere before it — am I signed in, as whom, and how do I
 * leave.
 *
 * **It is one component because those three questions are the same on both
 * surfaces.** `(site)` and `(admin)` had a header each for a while, and the two
 * were byte-identical apart from four values — where the wordmark points, what it
 * announces, what shows when there is no session, and which sign-out action the
 * menu gets (#17). Everything around them was duplicated: the session read, the
 * row, the `<noscript>` rule, the placeholder. So the four are props and the rest
 * is here.
 *
 * **What it deliberately does not decide** is anything a shell should differ on.
 * A caller says where home is; a caller says whether a signed-out person is
 * offered a door. `(admin)` offers none, because a person on `/admin/sign-in` is
 * already looking at one and the site's door is the wrong one.
 *
 * **The session read is dynamic and must stay that way.** No `use cache` around
 * it: a cached session read is one person's identity served to the next person,
 * which is the failure ADR-0011 and `apps/web/AGENTS.md` are both about. Cache
 * Components therefore requires a `<Suspense>` boundary, and each group's
 * `layout.tsx` owns it — `[stream]` from the framework's own menu, chosen over
 * `[block]` because no page should wait on chrome before it paints.
 *
 * **This is never the gate.** `requireAdminPage` in `lib/admin.ts` is what refuses
 * `/admin` with a 403, and the page calls it. What the session read here decides
 * is only whether there is a menu to draw.
 *
 * **The header's height is fixed and identical in every state.** That is not
 * styling: it is acceptance criterion 6. A person who signs in from a gated
 * redirect and lands back on the page she started from must see nothing move, and
 * {@link AppHeaderPlaceholder} holds the same `h-14` for the same reason —
 * `HeaderRow` is the one wrapper both render, so they cannot drift.
 */

import { headers } from "next/headers";
import Link from "next/link";
import type { ReactNode } from "react";
import { auth } from "@/lib/auth";
import { SessionMenuNoScript } from "@/app/_components/session-menu/no-script";
import { SessionMenu, type SignOutAction } from "@/app/_components/session-menu/session-menu";
import { StickyHeader } from "@/app/_components/sticky-header";
import { PRODUCT_NAME } from "./messages";

export interface AppHeaderProps {
  /** Where the wordmark goes: the Wall for `(site)`, the queue for `(admin)`. */
  readonly homeHref: string;
  /**
   * What the wordmark announces.
   *
   * Link text names its destination (`docs/policy/voice.md`), which for a
   * wordmark means the accessible name says where it goes rather than repeating
   * the word — so this is per-shell for the same reason `homeHref` is.
   */
  readonly homeLabel: string;
  /** The menu's sign-out action. The two shells land in different places. */
  readonly action: SignOutAction;
  /** Passed straight to {@link SessionMenu}; absent omits the account row. */
  readonly accountHref?: string;
  /**
   * What the right-hand side shows with no session, if anything.
   *
   * `(site)` passes `<SignInLink />`. `(admin)` passes nothing, and the absence
   * is the decision: the only state it renders signed-out in is `/admin/sign-in`,
   * where a person is already looking at the door — and the door the site offers
   * is the public one, which is the wrong one to point an Admin at.
   */
  readonly signedOut?: ReactNode;
}

/**
 * The row, and the **server** side of the donut.
 *
 * It is a Server Component: it renders the header's whole layout and hands it to
 * the client wrapper as `children`, so none of this reaches the client bundle —
 * only `StickyHeader`'s one positioning `<div>` and its sentinel do.
 *
 * The header and its placeholder both render this, which is what stops the two
 * drifting apart in height or gutter. The fixed `h-14` is acceptance criterion 6:
 * 56 px, room for a 40 px touch target with air around it on the phone this is
 * mostly read on. Nothing in the row changes at a breakpoint — at 360 px the
 * product name and a 40 px avatar do not contend for width, which is what variant
 * B bought.
 */
function HeaderRow({ children, ...props }: React.ComponentProps<"header">) {
  return (
    <StickyHeader {...props}>
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-4">
        {children}
      </div>
    </StickyHeader>
  );
}

export async function AppHeader({
  homeHref,
  homeLabel,
  action,
  accountHref,
  signedOut,
}: AppHeaderProps) {
  const session = await auth().getSession(await headers());

  return (
    <>
      <HeaderRow>
        {/*
          There is no logo — the product has none yet, and inventing one is a
          brand decision no ticket here owns. The wordmark is a link in every
          state, including the signed-out one: chrome that stopped being a link
          would change shape for no reason a reader could name.
        */}
        <Link
          href={homeHref}
          aria-label={homeLabel}
          className="focus-visible:ring-ring rounded-sm text-base font-semibold tracking-tight whitespace-nowrap focus-visible:ring-2 focus-visible:outline-none"
        >
          {PRODUCT_NAME}
        </Link>

        {session ? (
          <SessionMenu email={session.email} action={action} accountHref={accountHref} />
        ) : (
          /*
            `?? null` rather than rendering nothing at all: `justify-between`
            wants both children in every state, so the product name stays left
            and nothing slides across when a shell offers no signed-out control.
          */
          (signedOut ?? null)
        )}
      </HeaderRow>

      {/* The menu's other half — see `no-script.tsx`. Only where there is a menu. */}
      {session ? <SessionMenuNoScript /> : null}
    </>
  );
}

/**
 * What the boundary shows while the session read is in flight.
 *
 * **Not `AppHeaderSkeleton`, and the name matters here.** It renders no skeleton —
 * the registry exports `Skeleton` for that, and a reader meeting that name would
 * reasonably expect shimmer bars. What this holds is the header's exact height and
 * gutter and nothing else, so the first paint and the resolved paint are the same
 * shape: it is a placeholder, and there is nothing to shimmer because the only
 * thing arriving is a 40 px avatar or a short link.
 *
 * **It takes no props**, which is worth stating: nothing a shell configures
 * changes its size. The wordmark is the same string in both, and it is rendered at
 * `opacity-0` only to hold the width the resolved header will need.
 *
 * `aria-hidden`, because a placeholder has nothing to announce and a screen-reader
 * user should meet the resolved header rather than a description of a gap.
 */
export function AppHeaderPlaceholder() {
  return (
    <HeaderRow aria-hidden="true">
      <span className="text-base font-semibold tracking-tight whitespace-nowrap opacity-0">
        {PRODUCT_NAME}
      </span>
    </HeaderRow>
  );
}
