/**
 * The controls, at the seam a running server cannot show: **what they write to
 * the URL**.
 *
 * `nuqs`' own testing adapter stands in for the router, so a case can hand the
 * component a query string and read back the one it would have navigated to.
 * That is the whole contract between this panel and the page — the page reads
 * `searchParams` and nothing else — so it is the thing worth pinning here, and
 * `_lib/filters.test.ts` covers the other side of the same string.
 *
 * **The `<form>` is asserted too**, because it is the no-JavaScript mechanism
 * and it is invisible in every other test: `method`, `action` and a `name` on
 * each of the three controls are what make a submit reach the server at all when
 * nothing has hydrated.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NuqsTestingAdapter, type OnUrlUpdateFunction } from "nuqs/adapters/testing";
import { formOf, submittedFrom } from "@/testing/form-data";
import { BrowseFiltersForm } from "./browse-filters";

const searchButton = () => screen.getByRole<HTMLButtonElement>("button", { name: "Buscar" });

const SKILLS = (
  <>
    <option value="home-cooking">Cocinar almuerzos y comida casera</option>
    <option value="baking-and-pastry">Panadería y repostería</option>
  </>
);

function mount(searchParams: string, onUrlUpdate?: OnUrlUpdateFunction) {
  return render(<BrowseFiltersForm skillOptions={SKILLS} />, {
    wrapper: ({ children }) => (
      <NuqsTestingAdapter searchParams={searchParams} onUrlUpdate={onUrlUpdate}>
        {children}
      </NuqsTestingAdapter>
    ),
  });
}

describe("what the controls say the URL says", () => {
  it("opens empty when nothing is filtered", () => {
    mount("");

    expect(screen.getByRole("searchbox", { name: "Qué trabajo buscas" })).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "Capacidad" })).toHaveValue("");
    expect(screen.getByRole("radio", { name: "Cualquier ciudad" })).toBeChecked();
  });

  it("opens holding every term the URL carries", () => {
    mount("?q=panaderia&skill=baking-and-pastry&city=pereira");

    expect(screen.getByRole("searchbox", { name: "Qué trabajo buscas" })).toHaveValue("panaderia");
    expect(screen.getByRole("combobox", { name: "Capacidad" })).toHaveValue("baking-and-pastry");
    expect(screen.getByRole("radio", { name: "Pereira" })).toBeChecked();
  });

  /**
   * The way out of a narrowed list is a real link to the unnarrowed one, so it
   * works with JavaScript unavailable — and it is absent when there is nothing
   * to clear, rather than present and inert.
   */
  it("offers to clear the filters only once something is set", () => {
    mount("");
    expect(screen.queryByRole("link", { name: "Quitar los filtros" })).toBeNull();

    mount("?city=pereira");
    expect(screen.getByRole("link", { name: "Quitar los filtros" })).toHaveAttribute(
      "href",
      "/profiles",
    );
  });
});

describe("what the controls write", () => {
  it("writes the Skill in the name the page reads it by", async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    mount("", onUrlUpdate);

    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Capacidad" }),
      "baking-and-pastry",
    );

    expect(onUrlUpdate.mock.lastCall?.[0].queryString).toBe("?skill=baking-and-pastry");
  });

  it("writes the city, and keeps the words already typed", async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    mount("?q=panaderia", onUrlUpdate);

    await userEvent.click(screen.getByRole("radio", { name: "Pereira" }));

    expect(onUrlUpdate.mock.lastCall?.[0].searchParams.get("city")).toBe("pereira");
    expect(onUrlUpdate.mock.lastCall?.[0].searchParams.get("q")).toBe("panaderia");
  });

  /**
   * A term nobody set leaves no `?skill=` behind. This is what the native `GET`
   * form could not do — a submit sends every named control, empty ones included
   * — and it is why a shared URL says only what somebody chose.
   */
  it("takes a term out of the URL rather than writing it empty", async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    mount("?q=panaderia&city=pereira", onUrlUpdate);

    await userEvent.click(screen.getByRole("radio", { name: "Cualquier ciudad" }));

    expect(onUrlUpdate.mock.lastCall?.[0].searchParams.has("city")).toBe(false);
    expect(onUrlUpdate.mock.lastCall?.[0].queryString).toBe("?q=panaderia");
  });

  /**
   * A cursor names a row's position in an ordering, and an ordering over a
   * different population is a different ordering — so changing a filter has to
   * drop it, or the reader lands at row 48 of a list that no longer has 48 rows.
   */
  it("drops the page cursor whenever a filter changes", async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    mount("?after=abcdefghijklmnop", onUrlUpdate);

    await userEvent.click(screen.getByRole("radio", { name: "Dosquebradas" }));

    expect(onUrlUpdate.mock.lastCall?.[0].searchParams.has("after")).toBe(false);
  });
});

/**
 * With JavaScript unavailable none of the above runs, and the form is the whole
 * mechanism: the browser serialises the named controls into the query string and
 * navigates. None of it is visible to a test that only drives the hydrated path,
 * which is why it is asserted as markup.
 */
describe("the form the browser submits on its own", () => {
  /**
   * **`FormData` rather than an assertion about the markup.** What matters is
   * what a native submit would *send*, and the browser's own serialiser is the
   * thing that decides it — so this asks it, instead of enumerating elements and
   * hoping the list is the one the browser would read. It covers all three names
   * and all three values at once, including the city, whose value lives on a
   * hidden native radio that has no accessible role for a query to find.
   */
  function submitted(searchParams: string): Record<string, FormDataEntryValue> {
    mount(searchParams);
    // A `<form>` with no accessible name has no role, so it is reached from its
    // submit button: `button.form` is the form a native submit posts.
    return Object.fromEntries(submittedFrom(searchButton()));
  }

  it("sends every term the URL is carrying", () => {
    expect(submitted("?q=panaderia&skill=baking-and-pastry&city=pereira")).toEqual({
      q: "panaderia",
      skill: "baking-and-pastry",
      city: "pereira",
    });
  });

  /**
   * A native submit sends **every** named control, empty ones included — which
   * is why the unfiltered form produces `?q=&skill=&city=` and why the hydrated
   * path writes the URL through `nuqs` instead, where `clearOnDefault` takes an
   * unset term out. The server drops the empty ones either way; this pins the
   * difference the two paths actually have.
   */
  it("sends the empty terms too, which is the price of needing no JavaScript", () => {
    expect(submitted("")).toEqual({ q: "", skill: "", city: "" });
  });

  it("is a GET form pointed at the route that reads it", () => {
    mount("");
    const form = formOf(searchButton());

    expect(form).toHaveAttribute("method", "get");
    expect(form).toHaveAttribute("action", "/profiles");
  });

  it("carries a submit, so there is something to press", () => {
    mount("");

    expect(screen.getByRole("button", { name: "Buscar" })).toHaveAttribute("type", "submit");
  });
});
