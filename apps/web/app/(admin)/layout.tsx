/**
 * The Admin's shell — deliberately not the Worker's, and no longer nothing at all.
 *
 * **What is absent is still the point.** `SiteHeader` carries a session menu whose
 * route into `/account` belongs to the Worker's own Account, a sign-in link for the
 * public door, and a wordmark that goes to the Wall. None of that belongs above a
 * moderation queue, and a nested layout cannot remove a parent's chrome — which is
 * why the root layout gave its header up to `(site)` and this group renders its
 * own.
 *
 * **What the first version got wrong was reading "not the site header" as "no
 * header".** A surface with no product name and no way out reads as a detached
 * tool rather than as the same product seen from the operator's side, and the way
 * out was missing outright: an Admin could reach `/admin` and had nothing to press
 * to leave. `AdminHeader` answers the same three questions the site header does —
 * am I signed in, as whom, how do I leave — and carries none of the routes that
 * made the Worker's chrome wrong here.
 *
 * **`noindex` is not set here.** `/admin` and `/admin/*` are on NFR8's list in
 * `lib/gated-routes.ts`, so the `X-Robots-Tag` header arrives from
 * `next.config.ts` for every route below — and each page still sets
 * `metadata.robots` for the `<meta>` half, because NFR8 wants both.
 */

import * as React from "react";
import { AdminHeader, AdminHeaderPlaceholder } from "./_components/admin-header/admin-header";

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="bg-muted min-h-svh">
      {/*
        The header reads the session, which is **dynamic** — no `use cache`
        anywhere near it, per ADR-0011 and `apps/web/AGENTS.md`, because a cached
        session read serves one person's identity to the next.

        Cache Components therefore requires a boundary. `[stream]` and not
        `[block]`, which is the opposite of the choice `/admin/page.tsx` makes one
        level down, and the two are not in tension: the page blocks because its
        **status code** depends on the gate, and a streamed 200 shell would answer
        before the gate did. Chrome carries no status and refuses nobody, so
        blocking on it would make the 403 — a page with nothing to read from the
        database — wait on a session read to paint a header that will be empty.
      */}
      <React.Suspense fallback={<AdminHeaderPlaceholder />}>
        <AdminHeader />
      </React.Suspense>
      {children}
    </div>
  );
}
