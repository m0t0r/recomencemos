"use client";

/**
 * The way in, for someone with no session.
 *
 * **Offering it was acceptance criterion 5's deferred decision**, taken at shape
 * and recorded in the brief. It clears the two surfaces it had to be judged
 * against: it makes no claim about verification or money, so it gives story 11's
 * standing notices ([#22](https://github.com/m0t0r/recomencemos/issues/22)) no
 * second source, and it sits in chrome rather than in the content region story
 * 4's Wall ([#21](https://github.com/m0t0r/recomencemos/issues/21)) owns. It is
 * also what makes criterion 6 structural rather than reserved: the header is the
 * same height signed out and signed in, so nothing moves across the boundary.
 *
 * **It is suppressed on `/sign-in`**, where it would point at the page you are
 * already on — a link that goes nowhere is worse than no link, and this is the
 * one page where the destination and the origin are the same.
 *
 * **Why a Client Component for a link.** `usePathname` is the only reliable read
 * of the current path in the App Router, and a Server Component has none — Next
 * exposes no request path to `headers()`. It is rendered on the server too, so
 * the correct markup is in the first response and the suppression does not wait
 * for hydration; nothing here is interactive and nothing is deferred.
 */

import { buttonVariants } from "@repo/design-system/components/button";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SIGN_IN } from "./messages";

/**
 * Owned by `@repo/domain` as `SIGN_IN_PATH` and restated here as a literal on
 * purpose: importing it would pull a server-only module's subpath into a
 * `"use client"` graph, and the value is a route this app defines rather than
 * one the domain decides. If they ever disagree, the domain's is the one Better
 * Auth redirects to.
 */
const SIGN_IN_PATH = "/sign-in";

export function SignInLink() {
  const pathname = usePathname();

  /**
   * Rendered as an empty span rather than `null` so the flex row keeps both its
   * children and its `justify-between` in every state — the product name stays
   * left, and nothing slides across when the suppression applies.
   */
  if (pathname === SIGN_IN_PATH) return <span />;

  return (
    /*
      **Primary weight, not outline.** Signed out, this is the only action the
      shell offers and the only thing in the row that is not the product's own
      name — so there is nothing for a primary weight to compete with, and an
      outline button reads as the secondary half of a pair that does not exist.
      `primary` carries primary actions and is not decoration (`DESIGN.md` →
      Colors); one accent on a Restrained palette, on the one control. It is the
      variants' own default, so no `variant` is named.

      **`buttonVariants` on a plain `<Link>`, not `<Button render={<Link/>}>`.**
      This navigates, so it is a link and must announce as one. Handing the
      registry's `Button` a link makes Base UI complain that native button
      semantics were stripped, and the flag it suggests — `nativeButton={false}` —
      stamps `role="button"` onto the `<a>`, which is the opposite of the fix: it
      takes a working link and hides it from anyone navigating by links. The test
      in `session-menu.test.tsx` querying `getByRole("link")` is what caught that.

      Reaching for the variants directly is the registry's own answer for a link
      that looks like a button: identical styling, no button behaviour, no
      warning, and the element stays what it is.
    */
    <Link href={SIGN_IN_PATH} className={buttonVariants({ size: "lg" })}>
      {/*
        No icon, deliberately. _Salir_ carries one because it is a row in a menu
        that later stories add rows to, and a leading icon is what makes a list
        of rows scannable. This is a lone primary button holding a single word:
        an icon beside it decorates rather than distinguishes, and `primary`
        weight is already doing the work of marking it as the action.
      */}
      {SIGN_IN}
    </Link>
  );
}
