/**
 * What a running server cannot show about this field, and what happy-dom can.
 *
 * **The upload itself is not here and cannot be.** There is no 2D canvas
 * context and no `createImageBitmap` in this environment, and a mocked
 * `downscale` would be asserting that the component calls a function — which is
 * the wiring test this repository cuts. The picking, the downscale, the PUT and
 * the four refusals verify at seam 3 against a real browser.
 *
 * **What is worth pinning here is the markup**, which is where this field's
 * accessibility claims live and where a refactor breaks them silently:
 *
 * - The control is a **real `<input type="file">` with a real label**, so a
 *   screen reader announces one control with one name. The lint rule for that
 *   cannot see through Base UI's `render` prop — the disable comment in the
 *   component points here, so this is the assertion that has to be real.
 * - **NFR4's exception is stated where the field is**, and the sentence stands
 *   *in place of* the control rather than beside it.
 * - **No hidden input mirrors the key** (ADR-0015). That absence is unassertable
 *   any other way, which is the escape hatch `CLAUDE.md` names by name.
 */

import { render, screen } from "@testing-library/react";
import { PHOTO_INPUT_ACCEPT } from "@repo/storage/limits";
import { PHOTO_CHOOSE, PHOTO_HELP, PHOTO_NOTE } from "@/app/_lib/profile-form/messages";
import { PhotoField } from "./photo-field";

/**
 * **The action module is doubled, and `vi.hoisted` is what lets the import above
 * stay static** — `skill-request-row.test.tsx` sets the shape and `CLAUDE.md`
 * says why: a factory closing over a plain `const` reads it in its temporal dead
 * zone the moment a static import evaluates the mocked module.
 *
 * Why it has to be doubled at all: `../actions` is a `"use server"` module, and
 * nothing strips that in a Vitest run — so importing the component pulls the
 * whole server graph, `@repo/domain` and `@repo/observability` included, into a
 * happy-dom environment. Both refuse, loudly and correctly. That is those
 * packages' guards working rather than something to route around, and it is why
 * an action's *behaviour* verifies at seam 3 against the compiled endpoint
 * instead of here.
 */
const { createPhotoUpload } = vi.hoisted(() => ({ createPhotoUpload: vi.fn() }));

vi.mock("../actions", () => ({ createPhotoUpload }));

/**
 * `hydrated` defaults to `true` because that is the state every case below is
 * about — the control exists and she is using it. The unhydrated branch is its
 * own case at the bottom of the file, and it is the one that matters most, so
 * it passes `false` explicitly rather than relying on a default.
 */
function renderField(hydrated = true) {
  return render(<PhotoField onPhotoKeyChange={() => {}} hydrated={hydrated} />);
}

describe("PhotoField", () => {
  /**
   * A role query rather than a selector, because the question is whether a
   * *user* can reach the control — which is what NFR20 is about, and what a
   * `querySelector` on `input[type=file]` would not answer.
   */
  it("is one labelled file input, reachable by name", () => {
    renderField();

    const input = screen.getByLabelText(PHOTO_CHOOSE);

    expect(input).toHaveAttribute("type", "file");
    expect(input).toHaveAttribute("accept", PHOTO_INPUT_ACCEPT);
  });

  /**
   * **One name, and it is the verb.** Two labels pointed at this input once —
   * the field's title and the trigger — and the accessibility tree announced
   * the concatenation, "Tu foto Elegir una foto". Found by reading the tree
   * against the running server, and pinned here so it cannot come back.
   */
  it("has exactly one accessible name", () => {
    renderField();

    expect(screen.getByLabelText(PHOTO_CHOOSE)).toHaveAccessibleName(PHOTO_CHOOSE);
  });

  /** The help line is announced with the control rather than found separately. */
  it("describes the control with the sentence that says publishing does not wait", () => {
    renderField();

    // A `RegExp` rather than `expect.stringContaining(...) as unknown as string`:
    // jest-dom accepts one natively, so the double cast was only there to get
    // past a type it did not need to fight.
    expect(screen.getByLabelText(PHOTO_CHOOSE)).toHaveAccessibleDescription(
      new RegExp(PHOTO_HELP.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  });

  /**
   * **The case the old one could not make, and the defect it was hiding.**
   *
   * NFR4 names the photo as its single exception and requires the form to say so
   * where the field appears. That used to be a `<noscript>` wrapping the
   * sentence while the input stayed a *sibling* — and `<noscript>` gates only
   * its own children, so the served document carried the explanation **and** a
   * working camera-roll button that then did nothing. The brief refuses exactly
   * that: "the no-JS branch renders the sentence in place of the control rather
   * than rendering a control that does nothing."
   *
   * The old case asserted only that a `<noscript>` element existed, which was
   * true the whole time the control was broken. It could not do better: React
   * writes a `<noscript>`'s children into the server HTML and renders it empty
   * on the client, so under happy-dom there is no sentence to find.
   *
   * Gating on `hydrated` makes the branch an ordinary render, so both halves are
   * assertable here — and both are asserted, because "the sentence is present"
   * without "the control is absent" is the bug passing again.
   */
  it("renders the sentence in place of the control before hydration", () => {
    renderField(false);

    expect(screen.getByText(PHOTO_NOTE)).toBeInTheDocument();
    expect(screen.queryByLabelText(PHOTO_CHOOSE)).toBeNull();
  });

  /** And the other way round, so neither half can be satisfied on its own. */
  it("renders the control and not the sentence once hydrated", () => {
    renderField();

    expect(screen.getByLabelText(PHOTO_CHOOSE)).toBeInTheDocument();
    expect(screen.queryByText(PHOTO_NOTE)).toBeNull();
  });

  /**
   * ADR-0015: values that travel with a submit and are not typed into it are
   * **bound arguments**, never hidden inputs. The field has no form of its own,
   * so it is posted from a named test form, and the browser's serialiser says
   * what a native submit would carry. The file input has no `name`, so any entry
   * at all is a field she never chose.
   */
  it("mirrors no key into a hidden input", () => {
    render(
      <form aria-label="formulario de prueba">
        <PhotoField onPhotoKeyChange={() => {}} hydrated />
      </form>,
    );
    const form = screen.getByRole<HTMLFormElement>("form", { name: "formulario de prueba" });

    expect([...new FormData(form).keys()]).toEqual([]);
  });

  /**
   * The field is not disabled before she has done anything, and the form around
   * it is never blocked. "She never waits for it" is the brief's whole shape,
   * and a field that started disabled would be the first step away from it.
   */
  it("is usable before anything has been picked", () => {
    renderField();

    expect(screen.getByLabelText(PHOTO_CHOOSE)).toBeEnabled();
  });
});
