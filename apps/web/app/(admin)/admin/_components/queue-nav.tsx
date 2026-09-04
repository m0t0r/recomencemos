"use client";

/**
 * The five sections, as the nav the whole queue hangs off.
 *
 * **A Client Component for one reason: `usePathname`.** With five routes and no
 * landing page, the only thing that says where the Admin is standing is the
 * current path, and the server has no reliable read of it inside a layout.
 * Nothing else here is interactive — the counts arrive as props and the section
 * links are links.
 *
 * **The counts arrive as rendered nodes, not as numbers.** Each badge is a
 * `<Suspense>` boundary the shell built on the server, so a slow branch cannot
 * hold up the nav and a section that answers first shows its figure first. That
 * is what lets this stay a client component with no data fetching in it at all.
 *
 * **The sidebar carries the whole backlog, and that is a requirement rather than
 * decoration**: with five routes and no overview screen, the oldest Offer would
 * otherwise hide behind a nav item nobody clicked.
 */

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/sidebar";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  QUEUE_NAV_GROUP_LABEL,
  QUEUE_NAV_LABEL,
  SESSIONS_NAV_LABEL,
  SIDEBAR_MOBILE_DESCRIPTION,
  SIDEBAR_MOBILE_TITLE,
  TOOLS_NAV_LABEL,
} from "../_lib/messages";

export interface QueueNavItem {
  readonly href: string;
  readonly label: string;
  /** The count and the late marker, rendered on the server inside a boundary. */
  readonly badge: ReactNode;
}

/**
 * The tools, which are deliberately **not** the sections.
 *
 * A section is a backlog and carries a count, an oldest item and a band; a tool
 * carries none of the three, so it sits under its own label rather than in the
 * list the shell measures the queue's health across. A sixth *section* would be a
 * spec amendment; this is not one.
 */
const TOOLS = [{ href: "/admin/sessions", label: SESSIONS_NAV_LABEL }] as const;

/**
 * Which item the Admin is standing on, **as the accessibility tree hears it**.
 *
 * The registry's `isActive` styles the row and sets a `data-` attribute, which is
 * exactly nothing to a screen-reader user: with five sections and no landing
 * screen, "which one am I on" is a question the tree has to be able to answer.
 * `aria-current="page"` is that answer.
 *
 * **The highlight is derived from this rather than computed beside it.** A second
 * `pathname === href` next to the first is a styling hook and a semantic that can
 * disagree, and the bug that produces — the tree naming one section while the eye
 * reads another — is invisible to whichever of the two you happen to check.
 */
function current(pathname: string, href: string): "page" | undefined {
  return pathname === href ? "page" : undefined;
}

export function QueueNav({ items }: { items: readonly QueueNavItem[] }) {
  const pathname = usePathname();

  return (
    <Sidebar
      collapsible="offcanvas"
      mobileTitle={SIDEBAR_MOBILE_TITLE}
      mobileDescription={SIDEBAR_MOBILE_DESCRIPTION}
      /*
        The registry positions the nav at `inset-y-0 h-svh`, which is right for an
        app whose sidebar is the topmost chrome. Here `(admin)/layout.tsx`'s
        header is above it, sticky and opaque at `z-40` against this at `z-10` —
        so left alone, the group label and the first section would render behind
        it. `3.5rem` is that header's `h-14`, which is acceptance criterion 6 of
        the ticket that built it and therefore a number that does not move.
      */
      className="top-14 h-[calc(100svh-3.5rem)]"
    >
      <SidebarContent>
        {/*
          **A landmark, and a named one.** The surface brief asks for the sidebar
          to be _"a landmark and skippable"_, and the registry renders plain
          `<div>`s all the way down — so the element is ours to supply. The name
          is what a screen reader's landmark list shows, and "navigation" on its
          own is what it shows without one.
        */}
        <nav aria-label={QUEUE_NAV_LABEL}>
          <SidebarGroup>
            <SidebarGroupLabel>{QUEUE_NAV_GROUP_LABEL}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    {/*
                      **`render={<Link/>}` so this announces as a link.** It
                      navigates, and `SidebarMenuButton` is a `useRender` over a
                      default `button` tag rather than the registry's `Button`,
                      so handing it a link swaps the element without stamping
                      `role="button"` over it — the mistake `sign-in-link.tsx`
                      records at length. `queue-nav.test.tsx` queries by link
                      role, which is what would catch it coming back.
                    */}
                    <SidebarMenuButton
                      render={<Link href={item.href} aria-current={current(pathname, item.href)} />}
                      isActive={current(pathname, item.href) === "page"}
                    >
                      <span className="truncate">{item.label}</span>
                      {item.badge}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>{TOOLS_NAV_LABEL}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {TOOLS.map((tool) => (
                  <SidebarMenuItem key={tool.href}>
                    <SidebarMenuButton
                      render={<Link href={tool.href} aria-current={current(pathname, tool.href)} />}
                      isActive={current(pathname, tool.href) === "page"}
                    >
                      <span className="truncate">{tool.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </nav>
      </SidebarContent>

      {/*
        **No `SidebarRail`.** The registry's edge handle toggles the same thing
        `SidebarTrigger` in the shell's header does, and the tree showed both of
        them under one name — two controls with identical accessible names, one
        of which `tabIndex={-1}` keeps off the keyboard path entirely. Observed
        running, not predicted. One control, in the header, reachable by keyboard
        and by pointer.
      */}
    </Sidebar>
  );
}
