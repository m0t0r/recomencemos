/**
 * The count announcement, which is the one thing on these two surfaces a screen
 * reader gets and a sighted reader does not.
 *
 * Queried by **role**, not by class: the question is whether a screen-reader user
 * is told the grid resolved, and `role="status"` is what answers it. A
 * `container.querySelector(".sr-only")` would pass on a `<div>` nobody is
 * announced to.
 */

import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { CountAnnouncement } from "./count-announcement";

describe("CountAnnouncement", () => {
  it("announces the count once the effect has run", async () => {
    render(<CountAnnouncement count={12} />);

    expect(await screen.findByRole("status")).toHaveTextContent("12 perfiles");
  });

  it("is polite, so it never interrupts what is being read", async () => {
    render(<CountAnnouncement count={3} />);

    expect(await screen.findByRole("status")).toHaveAttribute("aria-live", "polite");
  });

  /**
   * **The region exists before it has anything to say, and that is the design.**
   * A live region that arrives already populated is frequently not announced at
   * all — the announcement is the *change*. Rendering it empty and filling it a
   * tick later is what makes the change happen.
   */
  it("renders the region empty on the server, so filling it is a change", () => {
    // Rendered the way the *server* renders it, not through Testing Library —
    // `render` flushes effects, so it can only ever show the filled state, and
    // this assertion is precisely about the markup that arrives before them.
    const markup = renderToStaticMarkup(<CountAnnouncement count={12} />);

    // `output` carries the `status` role implicitly, which is what the two role
    // queries above assert against the live tree; here the question is only
    // whether the region arrived and whether it arrived empty.
    expect(markup).toContain("<output");
    expect(markup).not.toContain("12");
  });

  it("says one profile in the singular", async () => {
    render(<CountAnnouncement count={1} />);

    expect(await screen.findByRole("status")).toHaveTextContent("1 perfil");
  });
});
