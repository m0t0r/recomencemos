/**
 * The consent control, at `web:test`.
 *
 * Three things are asserted and each one is a property a running server could not
 * show more cheaply: that a person can reach the control **by role** rather than
 * by selector, that no hidden input has crept back in beside it, and that the
 * transmission sentence is actually announced with the checkbox rather than
 * merely printed near it.
 *
 * The `querySelector` in the hidden-input case is one of the two escape hatches
 * `CLAUDE.md` allows: a hidden input has no accessible role by definition, so its
 * **absence** is unassertable any other way. `sign-in-form.test.tsx` pins the same
 * property for the same reason.
 */

import { render, screen } from "@testing-library/react";
import { AuthorizationConsent } from "./authorization";
import { AUTHORIZATION_ANCHOR, AuthorizationText, PRIVACY_NOTICE_PATH } from "./authorization-text";
import {
  AUTHORIZATION_CHECKBOX_HELP,
  AUTHORIZATION_TEXT,
  CONSENT_LABELS,
} from "@/app/_lib/consent/messages";

/** The copy carries a full stop, which is a regex metacharacter. */
const escapeForRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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
   * A hidden input has no accessible role, so its absence has no role query.
   */
  it("carries no hidden input", () => {
    const { container } = render(<AuthorizationConsent id="consent" />);

    expect(container.querySelectorAll('input[type="hidden"]')).toHaveLength(0);
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
   * `name`, `value` and `required` live. That is a question about the HTML that
   * survives with JavaScript unavailable (NFR4) rather than about the
   * accessibility tree — the second of the two escape hatches `CLAUDE.md` allows
   * a selector for, and the reason the role query above cannot answer it: the
   * input carries `aria-hidden`.
   */
  it("posts a named checkbox the browser refuses to submit unticked", () => {
    const { container } = render(<AuthorizationConsent id="consent" />);

    const posted = container.querySelector<HTMLInputElement>('input[name="consent"]');

    expect(posted).not.toBeNull();
    expect(posted?.type).toBe("checkbox");
    expect(posted?.value).toBe("true");
    expect(posted?.required).toBe(true);
  });
});
