/**
 * The public product's footer: the name, where it is for, and the way to the
 * privacy notice. A `contentinfo` landmark, one per page, and nothing that
 * belongs to a page rather than to the site.
 *
 * It is a Server Component with no session read, so it needs no boundary and
 * ships nothing to the client. `(admin)` does not render it: the queue is an
 * operator's tool and the operator knows where the privacy notice is.
 */

import Link from "next/link";
import { PRODUCT_NAME } from "@/app/_components/app-header/messages";
import { FOOTER_PLACES, FOOTER_PRIVACY } from "./messages";

export function SiteFooter() {
  return (
    <footer className="border-border border-t">
      <div className="text-muted-foreground mx-auto flex w-full max-w-5xl flex-wrap items-baseline justify-between gap-x-6 gap-y-2 px-4 py-8 text-sm">
        <p>
          <span className="font-heading text-foreground text-lg font-medium">{PRODUCT_NAME}</span>{" "}
          <span>{FOOTER_PLACES}</span>
        </p>
        <Link
          href="/privacy"
          className="focus-visible:ring-ring hover:text-foreground rounded-sm underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
        >
          {FOOTER_PRIVACY}
        </Link>
      </div>
    </footer>
  );
}
