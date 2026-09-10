/**
 * The public product's chrome — the Wall, `/sign-in`, `/account`.
 *
 * **It is `AppHeader` with this shell's four answers**, and that is all it is
 * since #17. It was the whole header while `(site)` was the only group; `/admin`
 * then needed chrome of its own, and the two files that resulted were identical
 * apart from the values below. Everything they shared — the session read, the row,
 * the `<noscript>` rule, the placeholder — is in `app/_components/app-header/`.
 *
 * Shaped at `.impeccable/briefs/site-header.md`; ticket
 * [#80](https://github.com/m0t0r/recomencemos/issues/80).
 *
 * **It links only pages that exist**, as #80 asked: her profile, the Offers
 * that reached her, the Offers she sent, and `/account`.
 */

import { AppHeader } from "@/app/_components/app-header/app-header";
import { signOut } from "@/app/_components/session-menu/actions";
import { SignInLink } from "./sign-in-link";
import { HOME_LINK_LABEL, MY_PROFILE, PUBLISH } from "./messages";
import { profiles } from "@repo/domain/profiles";

export { AppHeaderPlaceholder as SiteHeaderPlaceholder } from "@/app/_components/app-header/app-header";

export function SiteHeader() {
  return (
    <AppHeader
      /* The Wall. The product name is the way back to it. */
      homeHref="/"
      homeLabel={HOME_LINK_LABEL}
      action={signOut}
      /* Her own Account — the only navigation this shell offers. */
      accountHref="/account"
      /*
        The Offers he has sent. Offered whether or not he has sent one: the page's
        empty state says what an Offer is for and routes into `/profiles`, which
        is a better answer than a row that appears once he has used the product.
      */
      sentOffersHref="/sent-offers"
      /*
        The Offers that have reached her. Offered whether or not she holds a
        profile, for the same reason: the empty state says what makes one arrive.
      */
      receivedOffersHref="/offers"
      /*
        The row she came for. One read per page for a signed-in session; a
        profile she holds points at it, and until then the row is the way to
        publish one.
      */
      profileRow={async (session) =>
        (await profiles.has(session.accountId))
          ? { href: "/my-profile", label: MY_PROFILE }
          : { href: "/publish", label: PUBLISH }
      }
      /*
        The way in, for someone with no session. Offering it was #80's acceptance
        criterion 5, and it is what makes criterion 6 structural rather than
        reserved: the header is the same height signed out and signed in, so
        nothing moves across the boundary.
      */
      signedOut={<SignInLink />}
    />
  );
}
