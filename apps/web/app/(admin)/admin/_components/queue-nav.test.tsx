/**
 * The nav, which is the only thing on this surface carrying the whole backlog.
 *
 * **With five routes and no landing screen, a count that a screen-reader user
 * cannot reach is a count nobody has.** So what is asserted here is the
 * accessibility tree rather than the markup: that each section is a **link**, that
 * the figure beside it is part of that link's accessible name, and that the
 * current section says it is current. Each of those has a way of being quietly
 * wrong that a CSS selector cannot see.
 */

import { render, screen } from "@testing-library/react";

/**
 * `vi.hoisted` so the imports below stay static: `vi.mock` is lifted above every
 * `const` in the file, and a factory closing over a plain `const pathname =
 * vi.fn()` would read it in its temporal dead zone the moment the mocked module
 * is imported.
 */
const { pathname } = vi.hoisted(() => ({ pathname: vi.fn(() => "/admin/offers") }));

vi.mock("next/navigation", () => ({ usePathname: pathname }));

import { SidebarProvider } from "@repo/design-system/components/sidebar";
import { QueueNav, type QueueNavItem } from "./queue-nav";
import { SectionBadge, SectionBadgeAbsent } from "./queue";
import { SESSIONS_NAV_LABEL } from "../_lib/messages";

const items: readonly QueueNavItem[] = [
  { href: "/admin/offers", label: "Propuestas", badge: <SectionBadge total={412} late /> },
  { href: "/admin/photos", label: "Fotos", badge: <SectionBadgeAbsent /> },
  {
    href: "/admin/skills",
    label: "Capacidades pedidas",
    badge: <SectionBadge total={0} late={false} />,
  },
];

beforeEach(() => {
  pathname.mockReturnValue("/admin/offers");
});

/**
 * The nav reads its open state from the provider's context, exactly as it does in
 * the shell. Rendering it bare throws, which is the registry telling the truth
 * about a component that is half of a pair.
 */
function renderNav(nav: readonly QueueNavItem[] = items) {
  return render(
    <SidebarProvider>
      <QueueNav items={nav} />
    </SidebarProvider>,
  );
}

describe("the queue nav", () => {
  /**
   * **A link, not a button.** These navigate, and handing a link to something
   * that stamps `role="button"` over it takes a working link away from anyone
   * moving by links — the mistake `sign-in-link.tsx` records at length, caught
   * there by exactly this query.
   */
  it("renders each section as a link to its route", () => {
    renderNav();

    expect(screen.getByRole("link", { name: /Propuestas/ })).toHaveAttribute(
      "href",
      "/admin/offers",
    );
    expect(screen.getByRole("link", { name: /Fotos/ })).toHaveAttribute("href", "/admin/photos");
  });

  /**
   * **The count is part of the link's accessible name.** The registry's badge
   * slot is positioned *outside* the button, so a figure rendered there is a
   * figure a screen-reader user has to go looking for. This is the assertion that
   * would catch it being moved back.
   */
  it("announces how much is waiting as part of the section's own name", () => {
    renderNav();

    expect(screen.getByRole("link", { name: /412 pendientes/ })).toBeInTheDocument();
  });

  /**
   * **Text, not colour** — the acceptance criterion, and WCAG 2.2 AA 1.4.1. The
   * marker rides inside the link so it is announced with the section rather than
   * as a stray word beside it.
   */
  it("carries the late marker inside the link that is late", () => {
    renderNav();

    expect(screen.getByRole("link", { name: /Fuera de plazo/ })).toHaveAttribute(
      "href",
      "/admin/offers",
    );
  });

  /**
   * A zero is the good state and is still a number. A section that is not
   * counting says something else entirely, and the two must not read alike.
   */
  it("keeps a section reporting zero distinct from one that is not counting", () => {
    renderNav();

    expect(screen.getByRole("link", { name: /0 pendientes/ })).toHaveAttribute(
      "href",
      "/admin/skills",
    );
    expect(screen.getByRole("link", { name: /todavía sin datos/ })).toHaveAttribute(
      "href",
      "/admin/photos",
    );
  });

  /**
   * Where the Admin is standing is the only thing this component reads the
   * pathname for — and it has to reach the accessibility tree, not just the
   * stylesheet. `data-active` is what the registry sets and what the highlight
   * hangs off; it says nothing to anybody who cannot see the highlight, which on
   * five sections with no landing screen is the question "which one am I on"
   * going unanswered.
   */
  it("says which section the Admin is on, in the accessibility tree", () => {
    pathname.mockReturnValue("/admin/photos");
    renderNav();

    expect(screen.getByRole("link", { name: /Fotos/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /Propuestas/ })).not.toHaveAttribute("aria-current");
  });

  /**
   * **The tool is not a section**, and the nav says so by keeping it out of the
   * list the counts live in: it has no figure, because nothing accumulates there.
   */
  it("reaches the sessions tool without giving it a count", () => {
    renderNav();

    const tool = screen.getByRole("link", { name: SESSIONS_NAV_LABEL });
    expect(tool).toHaveAttribute("href", "/admin/sessions");
    expect(tool).toHaveAccessibleName(SESSIONS_NAV_LABEL);
  });
});
