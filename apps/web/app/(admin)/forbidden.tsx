/**
 * NFR14's refusal, as a page with a real **403** status.
 *
 * `forbidden()` renders this file, and `experimental.authInterrupts` in
 * `next.config.ts` is what makes both available — the argument for choosing it
 * over a redirect, a thrown `AppError` and a `proxy.ts` is written at that option.
 *
 * **It is one screen for four different callers**, and offers no route onward. A
 * link to `/admin/sign-in` here would be a sign saying the door is this way, on a
 * page an anonymous caller can reach — which is precisely what answering 403
 * rather than redirecting exists to avoid. The Admin knows where the door is.
 *
 * It is inside `(admin)`, so it covers `/admin` and `/admin/*` and nothing else:
 * `forbidden()` resolves to the nearest boundary, and the public surfaces do not
 * refuse this way.
 *
 * **It exports no `metadata`, because `forbidden.tsx` is not one of the files Next
 * reads metadata from** — the refused *segment's* own `page.tsx` is, so the 403
 * response carries the queue's title. A first draft exported one here and the
 * runtime showed it having no effect at all.
 *
 * What that discloses is a route name to somebody who has just been told the route
 * exists — which is what a 403 rather than a 404 already says, and NFR14 chose
 * that trade deliberately. The `X-Robots-Tag` still applies, from the route list in
 * `lib/gated-routes.ts`, so no crawler holds it either way.
 */

import { ADMIN_SESSION_REQUIRED } from "./admin/_lib/messages";

export default function Forbidden() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-4 py-12">
      <p className="text-muted-foreground text-base text-pretty">{ADMIN_SESSION_REQUIRED}</p>
    </main>
  );
}
