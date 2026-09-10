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
 *
 * **Three questions here are about markup the tree does not contain** — an
 * `aria-live` with no role, an `svg` (which takes no role at all in this
 * environment, hidden or not), and whether the disclosure is a native
 * `<details>`. Those read the HTML React sends, as a string, rather than reaching
 * into the rendered DOM.
 */

import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
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
    render(<StandingNotices treatment={treatment} />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    // The accessibility tree has no way to report an `aria-live` that no role
    // exposes, so that half is read off the markup.
    expect(renderToStaticMarkup(<StandingNotices treatment={treatment} />)).not.toContain(
      "aria-live",
    );
  });

  /**
   * The marks are decoration beside a heading that already says the same thing.
   * An `svg` reaching the accessibility tree would announce a shape, and it is
   * the redundancy — not the icon — that answers "not conveyed by colour alone".
   */
  it("hides its marks from the accessibility tree", () => {
    // Counted, so the loop below cannot pass by finding no marks at all.
    const marks =
      renderToStaticMarkup(<StandingNotices treatment={treatment} />).match(/<svg\b[^>]*>/g) ?? [];

    expect(marks.length).toBeGreaterThan(0);
    for (const mark of marks) expect(mark).toContain('aria-hidden="true"');
  });

  it("carries every sentence of all three statements", () => {
    render(<StandingNotices treatment={treatment} />);

    for (const notice of STANDING_NOTICES) {
      for (const paragraph of [notice.lead, ...notice.detail]) {
        expect(screen.getByText(paragraph)).toBeInTheDocument();
      }
    }
  });
});

/**
 * **The clauses the ticket names by hand are never behind a tap.**
 *
 * This is the regression test for what `/code-review`'s Spec axis found: the
 * first cut put each statement's whole body inside `<details>`, so the sentence
 * naming a Hirer's details as self-asserted and the sentence saying a Block does
 * not remove her from the Wall were both collapsed by default — on the two
 * surfaces where an anonymous reader meets them and nowhere else.
 *
 * A `lead` is visible in **both** treatments by construction, and that is what
 * these assert. They are written against the accessibility tree's idea of
 * visibility, which is what a reader who has not tapped anything actually has.
 */
describe("what a reader sees before touching anything", () => {
  it.each(["disclosure", "expanded"] as const)(
    "%s shows every lead without being opened",
    (treatment) => {
      render(<StandingNotices treatment={treatment} />);

      for (const notice of STANDING_NOTICES) {
        expect(screen.getByText(notice.lead)).toBeVisible();
      }
    },
  );

  it("shows a Hirer's details are self-asserted, on the collapsed lists", () => {
    render(<StandingNotices treatment="disclosure" />);

    expect(screen.getByText(/igual que los tuyos/)).toBeVisible();
  });

  it("shows that a Block leaves her card on the Wall, on the collapsed lists", () => {
    render(<StandingNotices treatment="disclosure" />);

    expect(screen.getByText(/Tu perfil sigue en el muro/)).toBeVisible();
  });

  /**
   * The other half of the same rule: the disclosure genuinely hides something, or
   * it is a control with nothing behind it. `toBeVisible` is what separates the
   * two — the detail is in the document either way.
   */
  it("keeps the detail behind the disclosure, and only the detail", () => {
    render(<StandingNotices treatment="disclosure" />);

    for (const notice of STANDING_NOTICES) {
      for (const paragraph of notice.detail) {
        expect(screen.getByText(paragraph)).not.toBeVisible();
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
   * The accessibility tree reports a group with a disclosure triangle whether
   * that group is a native `<details>` or a `div` with `aria-expanded` and a
   * click handler — and the difference between those two is the whole of NFR4
   * here. A role query cannot tell them apart, so this reads the HTML a browser
   * with no JavaScript would receive.
   */
  it("uses native details, so it opens with no JavaScript", () => {
    const markup = renderToStaticMarkup(<StandingNotices treatment="disclosure" />);

    expect(markup.match(/<details\b/g)).toHaveLength(STANDING_NOTICES.length);
    expect(markup.match(/<summary\b/g)).toHaveLength(STANDING_NOTICES.length);
  });

  /**
   * **That it starts closed is asserted in user terms above**, by _"keeps the
   * detail behind the disclosure"_ — which reads what a reader can actually read
   * rather than which attribute is on the element, and would still fail if a
   * disclosure were open and merely styled shut.
   *
   * A role query cannot say it directly. Testing Library refuses `expanded` on
   * `role="group"` — _"aria-expanded is not supported on role group"_ — which is
   * the role `<details>` maps to, so the choice was the attribute or the
   * visibility. This one asserts only the count, which is a question about
   * structure and which a role query answers cleanly.
   */
  it("groups each statement, one disclosure per statement", () => {
    render(<StandingNotices treatment="disclosure" />);

    expect(screen.getAllByRole("group")).toHaveLength(STANDING_NOTICES.length);
  });
});

describe("the expanded treatment", () => {
  it("hides nothing behind a disclosure", () => {
    render(<StandingNotices treatment="expanded" />);

    expect(screen.queryAllByRole("group")).toHaveLength(0);
  });
});
