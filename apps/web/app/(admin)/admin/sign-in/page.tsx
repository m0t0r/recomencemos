/**
 * `/admin/sign-in` — the Admin's door, and the one route under `/admin` that does
 * **not** require an Admin session.
 *
 * **It is the exemption, and it is an exemption by omission rather than by rule.**
 * There is no allowlist anywhere: `requireAdminPage` is a call, and this page does
 * not make it. That is why the gate is a function each surface invokes rather than
 * a `proxy.ts` matching `/admin/:path*` with a carve-out — a carve-out is a second
 * place the boundary is described, and the first thing a later route does is fall
 * on the wrong side of it.
 *
 * **It sits under `/admin` on purpose**, even though nothing forces it to. NFR8's
 * prefix list in `lib/gated-routes.ts` already covers `/admin/:path*`, so this
 * surface inherits `X-Robots-Tag: noindex, nofollow` with no new row and no way to
 * forget one — and a door that advertised itself in a search index would undo, at
 * the crawler, exactly what answering 403 rather than redirecting protects.
 */

import type { Metadata } from "next";
import { AdminSignInForm } from "./_components/admin-sign-in-form";
import { ADMIN_SIGN_IN_PAGE_TITLE } from "./_lib/messages";

export const metadata: Metadata = {
  title: ADMIN_SIGN_IN_PAGE_TITLE,
  robots: { index: false, follow: false },
};

/**
 * **No `<Suspense>` and no dynamic read**, which is why this page needs neither.
 * Everything on it is a form; the session state that decides what to show lives in
 * Better Auth's cookies and is read by the actions, not by this render. Cache
 * Components fails a build on uncached data outside a boundary — there is none
 * here to be outside one.
 */
export default function AdminSignInPage() {
  return <AdminSignInForm />;
}
