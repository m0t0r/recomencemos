/**
 * The shell — one strip of chrome above every page.
 *
 * Shaped at `.impeccable/briefs/site-header.md`; ticket
 * [#80](https://github.com/m0t0r/recomencemos/issues/80). Mode is **Operate**,
 * and it is chrome rather than a destination: it answers three questions a
 * signed-in person could not ask anywhere before it — am I signed in, as whom,
 * and how do I leave.
 *
 * **What it links today is less than the ticket lists, on purpose.** `/account`,
 * `/my-profile` and her received Offers are all unbuilt (#13, stories 2 and 8),
 * and the ticket says _link only what exists_. So this is the identity and
 * _Salir_, and the layout those three hang on when they land.
 *
 * **The session read is dynamic and must stay that way.** No `use cache` around
 * it: a cached session read is one person's identity served to the next person,
 * which is the failure ADR-0011 and `apps/web/AGENTS.md` are both about. Cache
 * Components therefore requires a `<Suspense>` boundary, and `layout.tsx` owns
 * it — `[stream]` from the framework's own menu, chosen over `[block]` because
 * no page should wait on chrome before it paints.
 *
 * **The header's height is fixed and identical in every state.** That is not
 * styling: it is acceptance criterion 6. A person who signs in from a gated
 * redirect and lands back on the page she started from must see nothing move,
 * and the placeholder below holds the same `h-14` for the same reason —
 * `HeaderRow` is the one wrapper both render, so they cannot drift.
 */

import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { SignInLink } from "./sign-in-link";
import { StickyHeader } from "./sticky-header";
import { SessionMenu } from "./session-menu";
import { HOME_LINK_LABEL, PRODUCT_NAME } from "./messages";
import { SESSION_MENU_FALLBACK_SLOT, SESSION_MENU_SLOT } from "./slots";

/**
 * **The `<noscript>` rule, which is the whole no-JavaScript story.**
 *
 * The registry's `dropdown-menu` cannot open without JavaScript, and acceptance
 * criterion 3 requires _Salir_ to work when it is unavailable. So the menu is
 * hidden and a plain submit button is revealed — a second **trigger** on the one
 * form in `session-menu.tsx`, never a second sign-out path.
 *
 * `dangerouslySetInnerHTML` rather than JSX children, and it is the safe use of
 * it rather than an exception to the rule: the browser parses `<noscript>`
 * content as *text* when scripting is on, so React would hydrate a text node
 * against the `<style>` element it rendered and mismatch. The string is a
 * compile-time constant built from two identifiers — no interpolation of
 * anything a person typed, which is the property `dangerouslySetInnerHTML`
 * actually asks of a caller.
 *
 * **Why no `!important`:** Tailwind v4 puts `hidden` in the `utilities` cascade
 * layer, and an unlayered rule beats any layered one regardless of order or
 * specificity. This `<style>` is unlayered.
 *
 * **The honest gap, recorded rather than discovered later:** `<noscript>` fires
 * when JavaScript is *disabled*, not while it is *enabled but unhydrated*. In
 * that window the trigger is painted and inert and this fallback is hidden. The
 * Popover API would close it with no fallback at all, and NFR5 rules it out —
 * Baseline April 2024, about two months short of the 30-month Widely Available
 * bar. Worth re-reading in late 2026.
 */
const NO_SCRIPT_RULE =
  `<style>` +
  `[data-slot="${SESSION_MENU_SLOT}"]{display:none}` +
  `[data-slot="${SESSION_MENU_FALLBACK_SLOT}"]{display:inline-flex}` +
  `</style>`;

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
 * product name and a 40 px avatar do not contend for width, which is what
 * variant B bought.
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

export async function SiteHeader() {
  const session = await auth().getSession(await headers());

  return (
    <>
      <HeaderRow>
        {/*
          The product name is the way back to the Wall. Link text names its
          destination (`docs/policy/voice.md`), which for a wordmark means the
          accessible name says where it goes rather than repeating the word.

          There is no logo — the product has none yet, and inventing one is a
          brand decision this ticket does not own.
        */}
        <Link
          href="/"
          aria-label={HOME_LINK_LABEL}
          className="focus-visible:ring-ring rounded-sm text-base font-semibold tracking-tight whitespace-nowrap focus-visible:ring-2 focus-visible:outline-none"
        >
          {PRODUCT_NAME}
        </Link>

        {session ? <SessionMenu email={session.email} /> : <SignInLink />}
      </HeaderRow>

      {session ? <noscript dangerouslySetInnerHTML={{ __html: NO_SCRIPT_RULE }} /> : null}
    </>
  );
}

/**
 * What the boundary shows while the session read is in flight.
 *
 * **Not `SiteHeaderSkeleton`, and the name matters here.** It renders no
 * skeleton — the registry exports `Skeleton` for that, and a reader meeting
 * that name would reasonably expect shimmer bars. What this holds is the
 * header's exact height and gutter and nothing else, so the first paint and the
 * resolved paint are the same shape: it is a placeholder, and there is nothing
 * to shimmer because the only thing arriving is a 40 px avatar or a short link.
 *
 * `aria-hidden`, because a placeholder has nothing to announce and a
 * screen-reader user should meet the resolved header rather than a description
 * of a gap.
 */
export function SiteHeaderPlaceholder() {
  return (
    <HeaderRow aria-hidden="true">
      <span className="text-base font-semibold tracking-tight whitespace-nowrap opacity-0">
        {PRODUCT_NAME}
      </span>
    </HeaderRow>
  );
}
