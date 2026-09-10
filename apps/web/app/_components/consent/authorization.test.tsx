/**
 * The consent control, at `web:test`.
 *
 * Three things are asserted and each one is a property a running server could not
 * show more cheaply: that a person can reach the control **by role** rather than
 * by selector, that no hidden input has crept back in beside it, and that the
 * transmission sentence is actually announced with the checkbox rather than
 * merely printed near it.
 *
 * The two cases about what a form posts are asked of the browser's own
 * serialiser rather than of the markup: the control has no form of its own, so it
 * is rendered inside a named test form, and `FormData` over that form is exactly
 * what a native submit would send. A hidden input would show up there as a key.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { AuthorizationConsent } from "./authorization";
import { AUTHORIZATION_ANCHOR, AuthorizationText, PRIVACY_NOTICE_PATH } from "./authorization-text";
import {
  AUTHORIZATION_CHECKBOX_HELP,
  AUTHORIZATION_TEXT,
  CONSENT_LABELS,
} from "@/app/_lib/consent/messages";

/** The copy carries a full stop, which is a regex metacharacter. */
const escapeForRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The form the control is posted from; named, so the tree hands it back by role. */
const TEST_FORM = "formulario de prueba";

function renderInForm(ui: ReactNode) {
  render(<form aria-label={TEST_FORM}>{ui}</form>);
  return screen.getByRole<HTMLFormElement>("form", { name: TEST_FORM });
}

describe("AuthorizationText", () => {
  // One paragraph per thing being authorized, so a screen reader's paragraph
  // navigation is a way through a legal text nobody came here to read.
  it.each(AUTHORIZATION_TEXT)("renders %o", (paragraph) => {
    render(<AuthorizationText />);
    expect(screen.getByText(paragraph)).toBeInTheDocument();
  });
});

describe("AuthorizationConsent", () => {
  it("exposes the consent as a checkbox a person can reach by role", () => {
    render(<AuthorizationConsent id="consent" />);

    expect(
      screen.getByRole("checkbox", { name: CONSENT_LABELS.AUTHORIZATION_CHECKBOX }),
    ).toBeInTheDocument();
  });

  /**
   * The attribute is a courtesy, not the guarantee — an attacker posts straight
   * past it and the action's boundary parse is what refuses. What it buys is a
   * browser refusing the submit in her own language with no JavaScript involved,
   * which is the NFR4 half of the same rule.
   */
  it("marks the consent required, so a browser refuses the submit without it", () => {
    render(<AuthorizationConsent id="consent" />);

    expect(screen.getByRole("checkbox")).toBeRequired();
  });

  /**
   * **The transmission is what makes the consent express** (C15), and a
   * five-word label cannot carry it. It rides in `aria-describedby` instead, so
   * a screen reader announces the two together — which is the difference between
   * a four-word label and a four-word consent.
   */
  it("announces the international transmission with the checkbox", () => {
    render(<AuthorizationConsent id="consent" />);

    // `toHaveAccessibleDescription` takes a RegExp, which is what a partial match
    // is here — the error case below adds a second `aria-describedby` id, so an
    // exact-string assertion would be asserting the absence of an error too.
    expect(screen.getByRole("checkbox")).toHaveAccessibleDescription(
      new RegExp(escapeForRegExp(AUTHORIZATION_CHECKBOX_HELP)),
    );
  });

  it("adds the field error to what the checkbox announces", () => {
    render(<AuthorizationConsent id="consent" error="Marca la casilla para seguir." />);

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toHaveAccessibleDescription(/Marca la casilla para seguir\./);
    // And the help text is still announced beside it, rather than replaced by it.
    expect(checkbox).toHaveAccessibleDescription(
      new RegExp(escapeForRegExp(AUTHORIZATION_CHECKBOX_HELP)),
    );
    expect(checkbox).toBeInvalid();
  });

  /**
   * **ADR-0015's third rule, asserted rather than trusted.** The two consent
   * versions are what the form displayed, not what she typed, so they travel as
   * bound arguments — typed, validated on arrival, encoded by React, and present
   * with JavaScript unavailable. A hidden `<input>` mirroring server state is the
   * shape that rule replaces, and this is what stops one coming back.
   *
   * Unticked, the checkbox posts nothing — so any entry at all is a field nobody
   * typed.
   */
  it("carries no hidden input", () => {
    const form = renderInForm(<AuthorizationConsent id="consent" />);

    expect([...new FormData(form).keys()]).toEqual([]);
  });

  // Link text names its destination, and it points at the exact section rather
  // than at the top of a long page she would then have to scan.
  it("links to the authorization section of the notice, by name", () => {
    render(<AuthorizationConsent id="consent" />);

    expect(screen.getByRole("link", { name: CONSENT_LABELS.NOTICE_LINK })).toHaveAttribute(
      "href",
      `${PRIVACY_NOTICE_PATH}#${AUTHORIZATION_ANCHOR}`,
    );
  });

  /**
   * **What the browser actually posts, and what it refuses to post without.**
   *
   * Base UI's control is a `role="checkbox"` element beside a visually-hidden
   * real `<input>`; the input is the half a `<form>` submits, and it is where
   * `name`, `value` and `required` live. That matters with JavaScript unavailable
   * (NFR4), and the browser answers both halves itself: `checkValidity()` is the
   * refusal a native submit would make, and `FormData` is what it would send.
   */
  it("posts a named checkbox the browser refuses to submit unticked", async () => {
    const user = userEvent.setup();
    const form = renderInForm(<AuthorizationConsent id="consent" />);

    expect(form.checkValidity()).toBe(false);

    await user.click(screen.getByRole("checkbox", { name: CONSENT_LABELS.AUTHORIZATION_CHECKBOX }));

    expect(form.checkValidity()).toBe(true);
    expect([...new FormData(form).entries()]).toEqual([["consent", "true"]]);
  });
});
