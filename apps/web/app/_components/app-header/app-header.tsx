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
 * offered a door. `(admin)` offers none, because the one state it paints
 * signed-out in is its 403, and a refusal that pointed somewhere would undo what
 * answering 403 rather than redirecting is for.
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
 * **A Server Action that changes what this header shows must call `refresh()`
 * from `next/cache` before it returns or redirects.** This is the rule, and it is
 * written here because this is where the values it protects are read.
 *
 * The App Router does not re-render a layout on a client navigation inside its own
 * subtree, and this header is rendered by a layout. So every dynamic value below
 * is fixed at document load, and an action that changes one leaves the shell
 * saying something that is no longer true — on the page it redirects to, and on
 * every page reached by clicking after that. It was observed rather than predicted
 * (#171): publishing a profile left the menu offering _publish a profile_ above a
 * page reading _your profile is published_, and the Wall underneath it was correct
 * at the same moment, because a page segment re-renders and a layout does not.
 *
 * **`refresh()` rather than a revalidate API, and the reason is that there is no
 * cache to invalidate.** Everything this header reads is uncached by design — that
 * is what "the session read is dynamic and must stay that way" above forbids — so
 * `cacheTag`/`revalidateTag` have nothing to name, and `revalidatePath` would be
 * reaching for a server-cache API to get at what is a client-router effect. It is
 * also why `/account`'s `revalidatePath("/account")` is not the instrument to copy
 * here: that call re-renders one page's own data, and this is about the shell above
 * every page. `refresh()` refreshes the client router, which is what re-runs the
 * layout, and it may only be called from a Server Action.
 *
 * **A cookie is the exception, and knowing why stops the wrong conclusion being
 * drawn from _Salir_.** Next re-renders the current page automatically when a
 * Server Action sets or deletes a cookie through `cookies()`, so `endSession`
 * already corrects this header without asking for anything — observed, and stated
 * in the version-matched docs at `node_modules/next/dist/docs/` under Server
 * Actions. `publishProfile` writes only to the database, which is invisible to that
 * mechanism. So the rule is owed by an action that changes a value this row depends
 * on **and touches no cookie**; an action that signs somebody in or out is already
 * covered.
 *
 * Today `profileRow` is the only such value that can change inside a document's
 * life, so publishing is the only caller. Taking a profile down and deleting an
 * Account are the next two, and each would rediscover this bug rather than inherit
 * the fix. The unhydrated path needs nothing either: without JavaScript a form post
 * is a document navigation and the layout re-renders anyway (NFR4).
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
import type { AuthSession } from "@repo/domain/auth-handler";
import { auth } from "@/lib/auth";
import { SessionMenuNoScript } from "@/app/_components/session-menu/no-script";
import { DeferredSessionMenu } from "@/app/_components/session-menu/session-menu-deferred";
/**
 * `import type`, and it is load-bearing rather than tidy: a value import from
 * `./session-menu` here would put the module back in this route's client-
 * reference manifest and undo the split `session-menu-deferred.tsx` exists for.
 * The type is erased; the menu arrives in its own chunk.
 */
import type { SignOutAction } from "@/app/_components/session-menu/session-menu";
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
  /** Passed straight to {@link DeferredSessionMenu}; absent omits the account row. */
  readonly accountHref?: string;
  /**
   * The profile row for a signed-in session, resolved by the shell that has
   * one: `(site)` reads whether she holds a profile and names the row
   * accordingly; `(admin)` passes nothing.
   */
  readonly profileRow?: (session: AuthSession) => Promise<{ href: string; label: string }>;
  /**
   * What the right-hand side shows with no session, if anything.
   *
   * `(site)` passes `<SignInLink />`. `(admin)` passes nothing, and the absence
   * is the decision: the only state it renders signed-out in is its own 403,
   * where `forbidden.tsx` deliberately offers no route onward — chrome that
   * offered one anyway would put the link back on the page that refuses it.
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
  profileRow,
  signedOut,
}: AppHeaderProps) {
  const session = await auth().getSession(await headers());
  const profile = session && profileRow ? await profileRow(session) : undefined;

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
          className="font-heading focus-visible:ring-ring rounded-sm text-xl font-semibold tracking-[-0.01em] whitespace-nowrap focus-visible:ring-2 focus-visible:outline-none"
        >
          {PRODUCT_NAME}
        </Link>

        {session ? (
          /*
            The menu itself, reached through the client-side loader in
            `session-menu-deferred.tsx` rather than imported here — which is what
            keeps Base UI's popup stack out of every route's first load. Writing
            `next/dynamic` in *this* file instead buys nothing; that module says
            why.
          */
          <DeferredSessionMenu
            email={session.email}
            action={action}
            accountHref={accountHref}
            profile={profile}
          />
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
      <span className="font-heading text-xl font-semibold tracking-[-0.01em] whitespace-nowrap opacity-0">
        {PRODUCT_NAME}
      </span>
    </HeaderRow>
  );
}
