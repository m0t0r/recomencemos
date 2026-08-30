/**
 * The copy button — what a running server cannot show, and what a browser test
 * cannot assert cheaply either.
 *
 * The three things here are the three that would fail silently in a way nobody
 * would notice until the day the codes were needed:
 *
 * - **What lands on the clipboard.** A confirmation that says "copied" while the
 *   clipboard holds a bulleted list with a heading is a person pasting rubbish
 *   into a password manager and closing the page. Seam 3 can see the
 *   confirmation appear; reading the clipboard back out of a real browser
 *   cannot be done from here, so the assertion belongs at this seam.
 * - **That the refusal is a state.** `navigator.clipboard` refuses on an
 *   insecure origin, a denied permission, or an old browser, and a button that
 *   silently did nothing there is the worst version of this screen.
 * - **That both are announced.** This is the control that tells somebody whether
 *   they still have ten codes.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CopyCodes } from "./copy-codes";
import { COPY_CODES, COPY_CODES_DONE, COPY_CODES_FAILED } from "../_lib/messages";

const CODES = ["ABCD-EFGH", "2345-JKLM", "NPQR-STUV"];

/** happy-dom ships no clipboard, which is also true of an insecure origin. */
function stubClipboard(writeText: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
    writable: true,
  });
}

describe("CopyCodes", () => {
  it("copies the codes as plain newline-separated text", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);
    render(<CopyCodes codes={CODES} />);

    await userEvent.click(screen.getByRole("button", { name: COPY_CODES }));

    // Nothing else: no heading, no bullets, no trailing label. It pastes into
    // whatever holds it, and a decoration here is a line somebody has to delete
    // out of a secure note.
    expect(writeText).toHaveBeenCalledWith("ABCD-EFGH\n2345-JKLM\nNPQR-STUV");
  });

  it("announces that they were copied", async () => {
    stubClipboard(vi.fn().mockResolvedValue(undefined));
    render(<CopyCodes codes={CODES} />);

    await userEvent.click(screen.getByRole("button", { name: COPY_CODES }));

    expect(screen.getByRole("status")).toHaveTextContent(COPY_CODES_DONE);
  });

  /**
   * The live region is in the markup from the first render rather than mounted
   * on success — a region inserted at the same moment as its text is frequently
   * not announced at all.
   */
  it("has somewhere to announce into before anything has happened", () => {
    stubClipboard(vi.fn());
    render(<CopyCodes codes={CODES} />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("says so when the clipboard refuses, and names the fallback", async () => {
    stubClipboard(vi.fn().mockRejectedValue(new Error("denied")));
    render(<CopyCodes codes={CODES} />);

    await userEvent.click(screen.getByRole("button", { name: COPY_CODES }));

    expect(screen.getByRole("status")).toHaveTextContent(COPY_CODES_FAILED);
  });

  /**
   * The codes are selectable text whether or not this button works, which is
   * what makes the failure message true. Asserting the absence of a `disabled`
   * state is the cheap version of that: nothing about a refused clipboard should
   * stop a second attempt.
   */
  it("stays usable after a refusal", async () => {
    stubClipboard(vi.fn().mockRejectedValue(new Error("denied")));
    render(<CopyCodes codes={CODES} />);
    const button = screen.getByRole("button", { name: COPY_CODES });

    await userEvent.click(button);

    expect(button).toBeEnabled();
  });
});
