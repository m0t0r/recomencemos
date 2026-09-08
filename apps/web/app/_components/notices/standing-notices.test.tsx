/**
 * The standing notices, queried the way a person reaches them.
 *
 * **What this covers is the accessibility tree, which is the half a screenshot
 * cannot show and a running server shows only to somebody who thinks to look.**
 * Both treatments have to put the same three statements in the document outline
 * and name the region they sit in — and the disclosure treatment nearly did not,
 * which is why the heading-inside-`<summary>` case below is written as an
 * assertion rather than left to the markup.
 *
 * It is a Server Component with no data access, so Vitest can render it: nothing
 * here is `async` and nothing reads a session. What still belongs at seam 3 is
 * what it *looks* like and whether `<details>` opens with JavaScript unavailable.
 */

import { render, screen } from "@testing-library/react";
import { NOTICES_HEADING, STANDING_NOTICES } from "@/app/_lib/notices/messages";
import { StandingNotices } from "./standing-notices";

describe.each(["disclosure", "expanded"] as const)("the %s treatment", (treatment) => {
  it("is one region, named", () => {
    render(<StandingNotices treatment={treatment} />);

    expect(screen.getByRole("region", { name: NOTICES_HEADING })).toBeInTheDocument();
  });

  /**
   * **The three statements are headings in both treatments**, which is the point
   * of putting the heading element inside `<summary>`. A screen-reader user
   * listing a page's headings is doing the same thing a sighted reader does when
   * they skim, and the three absences are exactly what that skim has to find.
   */
  it.each(STANDING_NOTICES)("$key is a heading", ({ heading }) => {
    render(<StandingNotices treatment={treatment} />);

    expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
  });

  /**
   * **No live region, and this is the assertion the component exists to keep.**
   * `Alert` would have given `role="alert"` for free, and it would announce three
   * standing facts over whatever the reader was doing, on every route, every
   * time. The reasoning is in the component and in
   * `app/(admin)/admin/_components/shell-notices.tsx` before it.
   */
  it("announces nothing", () => {
    const { container } = render(<StandingNotices treatment={treatment} />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    // The accessibility tree has no way to report an `aria-live` that no role
    // exposes, which is the one case a role query cannot reach.
    expect(container.querySelector("[aria-live]")).toBeNull();
  });

  /**
   * The marks are decoration beside a heading that already says the same thing.
   * An `svg` reaching the accessibility tree would announce a shape, and it is
   * the redundancy — not the icon — that answers "not conveyed by colour alone".
   */
  it("hides its marks from the accessibility tree", () => {
    const { container } = render(<StandingNotices treatment={treatment} />);

    for (const svg of container.querySelectorAll("svg")) {
      expect(svg).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("carries every sentence of all three statements", () => {
    render(<StandingNotices treatment={treatment} />);

    for (const notice of STANDING_NOTICES) {
      for (const paragraph of notice.body) {
        expect(screen.getByText(paragraph)).toBeInTheDocument();
      }
    }
  });
});

describe("the heading level", () => {
  /**
   * The region is an `h2` under a page's `h1` and an `h3` inside a section that
   * has its own `h2` — the Wall's case. Getting it wrong costs a screen-reader
   * user the outline, and nothing on screen would look different, which is why it
   * is asserted rather than reviewed.
   */
  it("defaults to h2 for a region under the page heading", () => {
    render(<StandingNotices treatment="expanded" />);

    expect(screen.getByRole("heading", { name: NOTICES_HEADING, level: 2 })).toBeInTheDocument();
  });

  it("drops to h3 inside a section that has its own h2", () => {
    render(<StandingNotices treatment="expanded" level={3} />);

    expect(screen.getByRole("heading", { name: NOTICES_HEADING, level: 3 })).toBeInTheDocument();
  });

  it.each(STANDING_NOTICES)("puts $key one level below the region", ({ heading }) => {
    const { unmount } = render(<StandingNotices treatment="expanded" />);
    expect(screen.getByRole("heading", { name: heading, level: 3 })).toBeInTheDocument();
    unmount();

    render(<StandingNotices treatment="expanded" level={3} />);
    expect(screen.getByRole("heading", { name: heading, level: 4 })).toBeInTheDocument();
  });
});

describe("the disclosure treatment", () => {
  /**
   * `<details>` and not a button with state, because the elaboration has to open
   * with JavaScript unavailable — NFR4 is about the publishing flow, but a notice
   * a reader cannot open on a slow connection is a notice that is not there.
   *
   * `container.querySelector` rather than a role query: `<details>` reaches the
   * accessibility tree as a group with a disclosure triangle, and what is being
   * asserted here is that the *element* is the native one rather than a
   * reimplementation of it. That is a question about the markup, which is the
   * narrow case the repo's escape hatch is for.
   */
  it("uses native details, so it opens with no JavaScript", () => {
    const { container } = render(<StandingNotices treatment="disclosure" />);

    expect(container.querySelectorAll("details")).toHaveLength(STANDING_NOTICES.length);
    expect(container.querySelectorAll("summary")).toHaveLength(STANDING_NOTICES.length);
  });

  /** Closed on arrival: the absences lead, and the elaboration is a choice. */
  it("starts closed", () => {
    const { container } = render(<StandingNotices treatment="disclosure" />);

    for (const details of container.querySelectorAll("details")) {
      expect(details).not.toHaveAttribute("open");
    }
  });
});

describe("the expanded treatment", () => {
  it("hides nothing behind a disclosure", () => {
    const { container } = render(<StandingNotices treatment="expanded" />);

    expect(container.querySelector("details")).toBeNull();
  });
});
