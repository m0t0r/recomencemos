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
 * - **NFR4's exception is stated where the field is**, in a `<noscript>`, rather
 *   than in a footnote or not at all.
 * - **No hidden input mirrors the key** (ADR-0015). That absence is unassertable
 *   any other way, which is the escape hatch `CLAUDE.md` names by name.
 */

import { render, screen } from "@testing-library/react";
import { PHOTO_INPUT_ACCEPT } from "@repo/storage/limits";
import { PHOTO_CHOOSE, PHOTO_HELP } from "@/app/_lib/profile-form/messages";
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

function renderField() {
  return render(<PhotoField onPhotoKeyChange={() => {}} />);
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

    expect(screen.getByLabelText(PHOTO_CHOOSE)).toHaveAccessibleDescription(
      expect.stringContaining(PHOTO_HELP) as unknown as string,
    );
  });

  /**
   * NFR4 names the photo as its single exception and requires the form to say
   * so **where the field appears**. A `<noscript>` is the only element whose
   * content shows exactly when the control cannot work.
   *
   * **What this can assert is that the element is there, and no more — measured
   * rather than assumed.** React writes a `<noscript>`'s children into the
   * *server-rendered HTML* and renders the element empty on the client, so
   * under happy-dom its `innerHTML` is `""`. A first version of this case
   * asserted on the sentence and failed against `"<noscript></noscript>"`.
   *
   * That is not a gap in the feature: by the time a client render happens,
   * JavaScript is running and the `<noscript>` is correctly irrelevant. The
   * sentence's presence is a property of the document `next dev` serves, so it
   * verifies at seam 3 by reading that document — which is also the only place
   * "with JavaScript unavailable" is a real condition rather than a simulated
   * one.
   */
  it("carries a noscript beside the field for the exception to live in", () => {
    const { container } = renderField();

    expect(container.querySelector("noscript")).not.toBeNull();
  });

  /**
   * ADR-0015: values that travel with a submit and are not typed into it are
   * **bound arguments**, never hidden inputs. A hidden input has no accessible
   * role by definition, so its absence is unassertable through the
   * accessibility tree — which is one of the two cases `CLAUDE.md` sanctions a
   * `querySelector` for.
   */
  it("mirrors no key into a hidden input", () => {
    const { container } = renderField();

    expect(container.querySelector('input[type="hidden"]')).toBeNull();
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
