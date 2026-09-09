/**
 * What a running server cannot show about the Offer form: the HTML that survives
 * with no JavaScript, the absence of hidden inputs, the two facts stated before
 * the first field, and where focus lands when a submit is refused before it
 * leaves the browser.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  HIRER_NAME_LABEL,
  HIRER_PHONE_LABEL,
  OFFER_IMMUTABLE_NOTICE,
  OFFER_REVIEW_NOTICE,
  OFFER_REVIEW_WINDOW,
  OFFER_SUMMARY_LABEL,
  PAY_LABEL,
  SEND_OFFER_BUTTON,
  WHEN_LABEL,
  WORK_LABEL,
  offerSummaryHeading,
} from "../_lib/offer-messages";
import { OfferForm } from "./offer-form";

const { sendOffer } = vi.hoisted(() => ({
  sendOffer: Object.assign(vi.fn(), { bind: () => vi.fn() }),
}));

vi.mock("../actions", () => ({ sendOffer }));

const consentVersions = { notice: "2026-08-30", authorization: "2026-08-30" };

function renderForm(alreadyIdentified = false) {
  return render(
    <OfferForm
      profileSlug="k7m2qx6vb4tn5rzc"
      consentVersions={consentVersions}
      alreadyIdentified={alreadyIdentified}
    />,
  );
}

describe("the form", () => {
  it("keeps a native action and a named control for every field", () => {
    // The one place a raw DOM query is the right tool: "is there a `<form>` with
    // an `action`" is a question about the HTML that survives with no
    // JavaScript, not about the accessibility tree.
    const { container } = renderForm();
    const form = container.querySelector("form");

    expect(form?.getAttribute("action")).toBeTruthy();

    for (const name of ["workDescription", "payTerms", "whenText", "hirerName", "hirerPhone"]) {
      expect(container.querySelector(`[name="${name}"]`)).not.toBeNull();
    }
  });

  /**
   * **ADR-0015's third rule, asserted as an absence.** The slug and the two
   * consent versions travel as bound arguments; a hidden input mirroring the
   * slug would be the field an attacker edits to address the Offer to somebody
   * else, and this is what stops one coming back.
   *
   * A hidden input has no accessible role by definition, so its absence is
   * unassertable through any query built on the accessibility tree.
   */
  it("carries no hidden inputs at all", () => {
    const { container } = renderForm();

    expect(container.querySelectorAll('input[type="hidden"]').length).toBe(0);
  });

  it("puts the slug in no control a browser posts", () => {
    const { container } = renderForm();

    expect(container.innerHTML).not.toContain("k7m2qx6vb4tn5rzc");
  });
});

describe("the two facts, before he writes", () => {
  /**
   * The acceptance criterion and the tone matrix's rule for this surface: a
   * Hirer who learns after submitting that a person reads it first has learned
   * it too late to have written differently.
   */
  it("says a person reads it, how long that takes, and that he cannot change it", () => {
    renderForm();

    expect(screen.getByText(new RegExp(OFFER_REVIEW_NOTICE))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(OFFER_REVIEW_WINDOW))).toBeInTheDocument();
    expect(screen.getByText(OFFER_IMMUTABLE_NOTICE)).toBeInTheDocument();
  });

  /**
   * **Where each fact sits is the composition's own argument**, so the assertion
   * follows it rather than the other way round (`/prototype`, variant C).
   *
   * The review and the window are on the **closed control**, which is the state
   * he meets first — so they precede every field. The immutability is at the
   * **submit**, because that is where the decision is taken and a promise read at
   * the head of a panel is read too early to change what he writes. It therefore
   * comes *after* the fields on purpose, and an assertion demanding otherwise
   * would be pinning the composition C replaced.
   */
  it.each([false, true])(
    "puts the review and the window ahead of every field (first Offer: %s)",
    (alreadyIdentified) => {
      const { container } = renderForm(alreadyIdentified);
      const text = container.textContent ?? "";

      const notices = [text.indexOf(OFFER_REVIEW_NOTICE), text.indexOf(OFFER_REVIEW_WINDOW)];

      const fields = [WORK_LABEL, PAY_LABEL, WHEN_LABEL]
        .concat(alreadyIdentified ? [] : [HIRER_NAME_LABEL, HIRER_PHONE_LABEL])
        .map((label) => text.indexOf(label));

      expect(notices.every((at) => at >= 0)).toBe(true);
      expect(Math.max(...notices)).toBeLessThan(Math.min(...fields));
    },
  );

  it.each([false, true])(
    "puts the immutability at the submit, where the decision is taken (first Offer: %s)",
    (alreadyIdentified) => {
      const { container } = renderForm(alreadyIdentified);
      const text = container.textContent ?? "";

      const immutable = text.indexOf(OFFER_IMMUTABLE_NOTICE);

      expect(immutable).toBeGreaterThan(-1);
      // Said before he can press the thing it is about, and after the fields.
      expect(immutable).toBeLessThan(text.indexOf(SEND_OFFER_BUTTON));
      expect(immutable).toBeGreaterThan(text.indexOf(WORK_LABEL));
    },
  );
});

describe("who is writing", () => {
  /**
   * Collected once, on his first Offer (C4). The page decides from his Consent
   * row; this asserts the rendering follows the answer, in both directions.
   */
  it("asks for a name and a number on a first Offer", () => {
    renderForm(false);

    expect(screen.getByRole("textbox", { name: HIRER_NAME_LABEL })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: HIRER_PHONE_LABEL })).toBeInTheDocument();
  });

  it("asks for neither on a later one", () => {
    renderForm(true);

    expect(screen.queryByRole("textbox", { name: HIRER_NAME_LABEL })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: HIRER_PHONE_LABEL })).not.toBeInTheDocument();
  });

  /**
   * The *autorización* rides with them, before collection — which is the
   * requirement rather than a layout preference, and which is why it disappears
   * on a later Offer: consent is given once, not per send.
   */
  it("takes the autorización on a first Offer and not on a later one", () => {
    const { container, unmount } = renderForm(false);
    expect(container.querySelector('[name="consent"]')).not.toBeNull();
    unmount();

    const later = renderForm(true);
    expect(later.container.querySelector('[name="consent"]')).toBeNull();
  });
});

describe("a submit the browser refuses", () => {
  /**
   * Focus lands on the **summary**, not on the first bad field, so a
   * screen-reader user hears how many things are wrong before being dropped into
   * one — the rule the publishing form already follows.
   */
  it("moves focus to the summary, with the count first", async () => {
    const user = userEvent.setup();
    renderForm(true);

    await user.click(screen.getByRole("button", { name: SEND_OFFER_BUTTON }));

    // Named, because the registry's `Alert` carries `role="alert"` too — the
    // region this is about is the one with the accessible name.
    const summary = await screen.findByRole("alert", { name: OFFER_SUMMARY_LABEL });
    expect(summary).toHaveFocus();
    expect(summary).toHaveTextContent(offerSummaryHeading(3));
  });

  it("names each field that is wrong, and links to it", async () => {
    const user = userEvent.setup();
    const { container } = renderForm(true);

    await user.click(screen.getByRole("button", { name: SEND_OFFER_BUTTON }));

    // The summary renders in one pass, so the three links are all present by the
    // time the first resolves — awaited together rather than one at a time.
    const links = await Promise.all(
      [WORK_LABEL, PAY_LABEL, WHEN_LABEL].map((label) =>
        screen.findByRole("link", { name: label }),
      ),
    );

    for (const link of links) {
      expect(link.getAttribute("href")).toMatch(/^#/);
      // The target exists, which is what makes the link a link rather than a
      // string: a summary pointing at nothing is worse than no summary.
      expect(container.querySelector(link.getAttribute("href") ?? "")).not.toBeNull();
    }
  });

  it("says the same sentence beside the field itself", async () => {
    const user = userEvent.setup();
    renderForm(true);

    await user.click(screen.getByRole("button", { name: SEND_OFFER_BUTTON }));

    const work = screen.getByRole("textbox", { name: WORK_LABEL });
    expect(work).toHaveAttribute("aria-invalid", "true");
  });

  it("does not dispatch the action", async () => {
    const user = userEvent.setup();
    renderForm(true);

    await user.click(screen.getByRole("button", { name: SEND_OFFER_BUTTON }));

    expect(sendOffer).not.toHaveBeenCalled();
  });
});
