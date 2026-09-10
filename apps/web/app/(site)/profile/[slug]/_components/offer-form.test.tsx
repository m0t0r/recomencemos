/**
 * What a running server cannot show about the Offer form: the HTML that survives
 * with no JavaScript, the absence of hidden inputs, the two facts stated before
 * the first field, and where focus lands when a submit is refused before it
 * leaves the browser.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToStaticMarkup } from "react-dom/server";
import { CONSENT_LABELS } from "@/app/_lib/consent/messages";
import { fieldNamesFrom, formOf } from "@/testing/form-data";
import {
  HIRER_NAME_LABEL,
  HIRER_PHONE_LABEL,
  OFFER_CONSENT_REQUIRED,
  OFFER_FIELD_LABELS,
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

/**
 * **The bound action is the one the form dispatches**, so it is the one a
 * "not dispatched" assertion has to watch — and `bind` returns one shared mock
 * so that it can. A fresh `vi.fn()` per call leaves `sendOffer` itself uncalled
 * whatever the form does, and an assertion on it cannot fail.
 *
 * It answers with an empty result, which is what a completed action hands
 * `useActionState` — the form reads its verdict off whatever comes back.
 */
const { boundSendOffer, sendOffer } = vi.hoisted(() => {
  const bound = vi.fn(async () => ({}));
  return { boundSendOffer: bound, sendOffer: Object.assign(vi.fn(), { bind: () => bound }) };
});

vi.mock("../actions", () => ({ sendOffer }));

const consentVersions = { notice: "2026-08-30", authorization: "2026-08-30" };

const SLUG = "k7m2qx6vb4tn5rzc";

function offerForm(alreadyIdentified = false) {
  return (
    <OfferForm
      profileSlug={SLUG}
      consentVersions={consentVersions}
      alreadyIdentified={alreadyIdentified}
    />
  );
}

function renderForm(alreadyIdentified = false) {
  return render(offerForm(alreadyIdentified));
}

/**
 * What a native submit would send: the form the send button posts, read by the
 * browser's own serialiser. Sorted, because the question is which fields and
 * not the order they sit in.
 */
function postedFields() {
  return fieldNamesFrom(sendButton()).toSorted();
}

const sendButton = () => screen.getByRole<HTMLButtonElement>("button", { name: SEND_OFFER_BUTTON });

/** Every field a first Offer asks for, filled — so the box is the only thing left. */
async function fillFirstOffer(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByRole("textbox", { name: HIRER_NAME_LABEL }), "Carlos Mejía");
  await user.type(screen.getByRole("textbox", { name: HIRER_PHONE_LABEL }), "300 123 4567");
  await fillTerms(user);
}

async function fillTerms(user: ReturnType<typeof userEvent.setup>) {
  await user.type(
    screen.getByRole("textbox", { name: WORK_LABEL }),
    "Pintar la sala y el comedor de un apartamento",
  );
  await user.type(screen.getByRole("textbox", { name: PAY_LABEL }), "$250.000 al terminar");
  await user.type(screen.getByRole("textbox", { name: WHEN_LABEL }), "El sábado desde las ocho");
}

describe("the form", () => {
  it("keeps a native action and a named control for every field", () => {
    renderForm();

    expect(formOf(sendButton())).toHaveAttribute("action");
    expect(postedFields()).toEqual(
      expect.arrayContaining([
        "workDescription",
        "payTerms",
        "whenText",
        "hirerName",
        "hirerPhone",
      ]),
    );
  });

  /**
   * **ADR-0015's third rule, asserted as an absence.** The slug and the two
   * consent versions travel as bound arguments; a hidden input mirroring the
   * slug would be the field an attacker edits to address the Offer to somebody
   * else, and this is what stops one coming back.
   *
   * Exactly the fields he types, and nothing else: a hidden input would be one
   * more key. The unticked consent posts nothing, so it is absent from both.
   */
  it.each([
    [false, ["hirerName", "hirerPhone", "payTerms", "whenText", "workDescription"]],
    [true, ["payTerms", "whenText", "workDescription"]],
  ])("carries no hidden inputs at all (already identified: %s)", (alreadyIdentified, typed) => {
    renderForm(alreadyIdentified);

    expect(postedFields()).toEqual(typed);
  });

  /** Over the HTML React sends, so an attribute nobody posts cannot carry it either. */
  it("puts the slug nowhere in the markup", () => {
    expect(renderToStaticMarkup(offerForm())).not.toContain(SLUG);
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
    const consent = { name: CONSENT_LABELS.AUTHORIZATION_CHECKBOX };

    const { unmount } = renderForm(false);
    expect(screen.getByRole("checkbox", consent)).toBeInTheDocument();
    unmount();

    renderForm(true);
    expect(screen.queryByRole("checkbox", consent)).toBeNull();
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
    renderForm(true);

    await user.click(screen.getByRole("button", { name: SEND_OFFER_BUTTON }));

    // The summary renders in one pass, so the three links are all present by the
    // time the first resolves — awaited together rather than one at a time.
    const labels = [WORK_LABEL, PAY_LABEL, WHEN_LABEL];
    const links = await Promise.all(
      labels.map((label) => screen.findByRole("link", { name: label })),
    );

    // Each link points at the field it names, which is what makes it a link
    // rather than a string: a summary pointing at nothing is worse than no
    // summary. The field is found by its label, and its id is the target.
    for (const [index, link] of links.entries()) {
      const field = screen.getByRole("textbox", { name: labels[index] });
      expect(field.id).not.toBe("");
      expect(link).toHaveAttribute("href", `#${field.id}`);
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

    expect(boundSendOffer).not.toHaveBeenCalled();
  });
});

describe("consent on a first Offer", () => {
  /**
   * **Every other field filled, and the box left unticked** — the ordinary path,
   * no attacker required (#250). Once hydrated the form sets `noValidate`, so
   * the browser's own `required` check is gone and this parse is the only guard
   * before the request is made.
   */
  it("refuses an unticked box before the Offer leaves the browser", async () => {
    const user = userEvent.setup();
    renderForm(false);

    await fillFirstOffer(user);
    await user.click(screen.getByRole("button", { name: SEND_OFFER_BUTTON }));

    const summary = await screen.findByRole("alert", { name: OFFER_SUMMARY_LABEL });
    expect(summary).toHaveFocus();
    expect(summary).toHaveTextContent(offerSummaryHeading(1));
    expect(summary).toHaveTextContent(OFFER_CONSENT_REQUIRED);
    expect(boundSendOffer).not.toHaveBeenCalled();
  });

  it("says why beside the checkbox itself", async () => {
    const user = userEvent.setup();
    renderForm(false);

    await fillFirstOffer(user);
    await user.click(screen.getByRole("button", { name: SEND_OFFER_BUTTON }));

    const box = await screen.findByRole("checkbox", {
      name: CONSENT_LABELS.AUTHORIZATION_CHECKBOX,
    });
    expect(box).toBeInvalid();
    expect(box).toHaveAccessibleDescription(expect.stringContaining(OFFER_CONSENT_REQUIRED));
  });

  /** A summary item pointing at nothing is worse than no summary. */
  it("links the summary's consent item to the checkbox", async () => {
    const user = userEvent.setup();
    renderForm(false);

    await fillFirstOffer(user);
    await user.click(screen.getByRole("button", { name: SEND_OFFER_BUTTON }));

    const link = await screen.findByRole("link", { name: OFFER_FIELD_LABELS.consent });
    // The anchor lands on what the checkbox's label labels — found through that
    // association, the way assistive technology finds it.
    const labelled = screen.getAllByLabelText(CONSENT_LABELS.AUTHORIZATION_CHECKBOX);
    expect(labelled.map((element) => `#${element.id}`)).toContain(link.getAttribute("href"));
  });

  it("sends once the box is ticked", async () => {
    const user = userEvent.setup();
    renderForm(false);

    await fillFirstOffer(user);
    await user.click(screen.getByRole("checkbox", { name: CONSENT_LABELS.AUTHORIZATION_CHECKBOX }));
    await user.click(screen.getByRole("button", { name: SEND_OFFER_BUTTON }));

    await vi.waitFor(() => expect(boundSendOffer).toHaveBeenCalledOnce());
  });

  /** Consent is given once, not per send: a later Offer asks for no box and sends without one. */
  it("is not asked for on a later Offer, which sends without it", async () => {
    const user = userEvent.setup();
    renderForm(true);

    await fillTerms(user);
    await user.click(screen.getByRole("button", { name: SEND_OFFER_BUTTON }));

    await vi.waitFor(() => expect(boundSendOffer).toHaveBeenCalledOnce());
  });
});
