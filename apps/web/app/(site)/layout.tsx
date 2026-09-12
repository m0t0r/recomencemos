/**
 * The public product's shell — the Wall, `/sign-in`, `/account`, and every
 * surface a Worker or a Hirer reaches.
 *
 * **It was the root layout until #17.** Nothing about it changed except where it
 * lives: `/admin` needed a shell of its own, and a nested layout cannot remove a
 * parent's chrome, so the header moved down into the group that wants it. `(site)`
 * adds no URL segment, so every path below is exactly where it was.
 */

import * as React from "react";
import { SiteFooter } from "./_components/site-footer/site-footer";
import { SiteHeader, SiteHeaderPlaceholder } from "./_components/site-header/site-header";

export default function SiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    /*
      A column the height of the viewport, so the footer sits at the bottom of a
      short page rather than halfway up it. The page's own `<main>` is the child
      that grows; the header and the footer keep their height.
    */
    <div className="flex min-h-svh flex-col">
      {/*
        The shell (#80). It reads the session, which is **dynamic** — no
        `use cache` anywhere near it, per ADR-0011 and `apps/web/AGENTS.md`,
        because a cached session read serves one person's identity to the next.

        Cache Components therefore requires a boundary here. `[stream]` from the
        framework's own menu rather than `[block]`: no page should wait on chrome
        before it paints, and the fallback holds the header's exact height so
        nothing moves when the read resolves.
      */}
      <React.Suspense fallback={<SiteHeaderPlaceholder />}>
        <SiteHeader />
      </React.Suspense>
      <div className="flex grow flex-col">{children}</div>
      <SiteFooter />
    </div>
  );
}
