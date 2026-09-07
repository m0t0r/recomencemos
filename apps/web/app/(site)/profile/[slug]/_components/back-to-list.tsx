/**
 * The way out of this route, which every state on it offers.
 *
 * Three surfaces rendered the identical link — the profile, the paused read,
 * and (once it exists) the error state — and `/code-review` named the third
 * copy. One component because it is one affordance: whatever went wrong or did
 * not, the whole list is still there and carries no ceiling.
 *
 * `buttonVariants` on a plain `<Link>` rather than `<Button render={…}>`: this
 * navigates, so it is a link and must announce as one. The reason is written out
 * at length in `sign-in-link.tsx`.
 */

import { buttonVariants } from "@repo/design-system/components/button-variants";
import Link from "next/link";
import { TO_BROWSE } from "../_lib/messages";

export function BackToList() {
  return (
    <Link
      href="/profiles"
      className={buttonVariants({ variant: "outline", size: "sm", className: "self-start" })}
    >
      {TO_BROWSE}
    </Link>
  );
}
