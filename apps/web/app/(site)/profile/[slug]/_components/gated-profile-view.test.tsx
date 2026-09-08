/**
 * What a running server cannot show about this view, and what a seam-2 test
 * cannot either.
 *
 * Three things: that every free-text field is rendered as **content and never as
 * a URL** (the `javascript:` sentinel, the same case `own-profile-view.test.tsx`
 * pins from the owner's side); that the four fields NFR11 holds back are absent
 * from the **markup**, not merely from the object; and that her work history
 * resolves inside its own boundary, with the identity above it already painted.
 *
 * NFR10 is counted at seam 1 over the projection and here over the rendered
 * HTML, which are different claims: a component that took the gated shape and
 * then reached for something else would pass the first and fail this.
 */

import type { GatedIdentity } from "@repo/domain/profiles";
import { act, render, screen, within } from "@testing-library/react";
import { Suspense } from "react";
import { ABOUT_HEADING, NOTHING_MORE, TO_BROWSE, WORK_HISTORY_HEADING } from "../_lib/messages";
import { GatedProfileView } from "./gated-profile-view";

const PAYLOAD = "javascript:alert(1)";

const HELD = {
  fullName: "Ana María Restrepo Gómez",
  phone: "+573001234567",
  email: "ana@example.co",
} as const;

const profile: GatedIdentity = {
  slug: "k7m2p9q4w3x8y1z6",
  firstName: "Ana",
  lastInitial: "R",
  city: "pereira",
  headline: `Cocino almuerzos ${PAYLOAD}`,
  about: `Diez años cocinando ${PAYLOAD}`,
  skills: [{ slug: "home-cooking", labelEs: "Cocinar almuerzos y comida casera" }],
  photoUrl: null,
  publishedAt: new Date("2026-09-02T12:00:00Z"),
};

/**
 * The component suspends on its `workHistory` prop, so every case renders it
 * inside a boundary. `Promise.resolve` is enough — what is under test is the
 * shape of what resolves, not the timing, and the timing is seam 3's.
 *
 * **`render` is wrapped in an awaited `act`, and that is not ceremony.**
 * Measured: with a bare `render` the tree suspends inside the synchronous `act`
 * scope RTL opens, React logs _"a component suspended inside an `act` scope, but
 * the `act` call was not awaited"_, and the boundary then never resolves — every
 * `findBy…` times out against the skeleton. Awaiting the scope is what lets
 * React retry the suspended render. `findBy…` alone cannot fix it, because by
 * the time it runs the retry has already been abandoned.
 */
async function renderView(workHistory: readonly string[] = [`Panadería La Espiga ${PAYLOAD}`]) {
  let result!: ReturnType<typeof render>;

  await act(async () => {
    result = render(
      <Suspense fallback={<p>cargando</p>}>
        <GatedProfileView profile={profile} workHistory={Promise.resolve(workHistory)} />
      </Suspense>,
    );
  });

  return result;
}

describe("what crosses to the browser", () => {
  it("renders every free-text field as text and never as a URL", async () => {
    const { container } = await renderView();
    await screen.findByRole("heading", { name: WORK_HISTORY_HEADING });

    // Over the HTML rather than the tree: the question is whether the payload
    // ever becomes an attribute, wherever it renders.
    expect(container.innerHTML).toContain(PAYLOAD);

    // The escape hatch case: a URL-valued attribute is not in the accessibility
    // tree, so its absence is asserted over the markup.
    for (const element of container.querySelectorAll("[href], [src], [action]")) {
      for (const attribute of ["href", "src", "action"]) {
        expect(element.getAttribute(attribute) ?? "").not.toContain(PAYLOAD);
      }
    }
  });

  /**
   * NFR11's four held fields, read off the rendered markup. The component is
   * never handed them — that is the projection's job and seam 1 counts it — so
   * this is the assertion that nothing here reaches for them by another route,
   * and the one that would go red if `GatedIdentity` were widened.
   */
  it.each(Object.entries(HELD))("never renders her %s", async (_field, value) => {
    const { container } = await renderView();
    await screen.findByRole("heading", { name: WORK_HISTORY_HEADING });

    expect(container.innerHTML).not.toContain(value);
  });

  /** The spelling a person would read, as well as the one the column holds. */
  it("never renders her phone in its readable form either", async () => {
    const { container } = await renderView();
    await screen.findByRole("heading", { name: WORK_HISTORY_HEADING });

    expect(container.innerHTML).not.toContain("300 123 4567");
  });
});

describe("the hierarchy", () => {
  /**
   * Her headline is the `<h1>` and her name is under it. That is the same
   * hierarchy the row on the Wall argues for, carried to the page the row leads
   * to — she is described by what she can do, and a page headed by her name
   * would be a page about a person rather than about a capability.
   */
  it("heads the page with her own words, not with her name", async () => {
    await renderView();

    const heading = await screen.findByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent(profile.headline);
    expect(heading).not.toHaveTextContent("Ana R.");
  });

  it("names her and her city under the heading", async () => {
    await renderView();
    await screen.findByRole("heading", { name: WORK_HISTORY_HEADING });

    expect(screen.getByText(/Ana R\. · Pereira/)).toBeInTheDocument();
  });

  it("heads her self-description and her work history separately", async () => {
    await renderView();

    expect(await screen.findByRole("heading", { name: ABOUT_HEADING })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: WORK_HISTORY_HEADING })).toBeInTheDocument();
  });

  it("offers a link back to the whole list", async () => {
    await renderView();
    await screen.findByRole("heading", { name: WORK_HISTORY_HEADING });

    expect(screen.getByRole("link", { name: TO_BROWSE })).toHaveAttribute("href", "/profiles");
  });
});

describe("the work history", () => {
  it("renders her lines in the order they arrive", async () => {
    await renderView(["Primero", "Segundo", "Tercero"]);
    await screen.findByRole("heading", { name: WORK_HISTORY_HEADING });

    // The whole list, in order — `arrayContaining` plus three `indexOf`
    // comparisons said the same thing while admitting a fourth item nobody
    // wrote.
    //
    // By role rather than `.closest("section")`, which asserted a markup shape
    // and cast the result. `Section` renders `aria-labelledby`, so the section
    // *is* a named region and the accessibility tree can answer this — which
    // means the query now pins that wiring too, and fails if the heading ever
    // stops naming the region.
    const items = within(screen.getByRole("region", { name: WORK_HISTORY_HEADING }))
      .getAllByRole("listitem")
      .map((item) => item.textContent);

    expect(items).toEqual(["Primero", "Segundo", "Tercero"]);
  });

  /** A duplicate line is real data — two spells at the same employer — and React needs a key. */
  it("renders a repeated line twice", async () => {
    await renderView(["Aseo por días", "Aseo por días"]);
    await screen.findByRole("heading", { name: WORK_HISTORY_HEADING });

    expect(screen.getAllByText("Aseo por días")).toHaveLength(2);
  });

  /**
   * She published without one, which is a complete profile. A heading over a
   * blank space would read as something that failed to load, so the section is
   * absent rather than empty.
   */
  it("renders no section at all when she listed none", async () => {
    await renderView([]);
    await screen.findByRole("heading", { name: ABOUT_HEADING });

    expect(screen.queryByRole("heading", { name: WORK_HISTORY_HEADING })).toBeNull();
  });
});

describe("a profile with nothing in the two long fields", () => {
  it("says so, and points at the Skills that are still there", async () => {
    await act(async () => {
      render(
        <Suspense fallback={<p>cargando</p>}>
          <GatedProfileView profile={{ ...profile, about: "" }} workHistory={Promise.resolve([])} />
        </Suspense>,
      );
    });

    expect(screen.getByText(NOTHING_MORE)).toBeInTheDocument();
    expect(screen.getByText("Cocinar almuerzos y comida casera")).toBeInTheDocument();
  });
});
