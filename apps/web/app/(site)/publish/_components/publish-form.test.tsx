/**
 * What a running server cannot show about the publishing form: the HTML that
 * survives with no JavaScript, the absence of hidden inputs, the Skill picker
 * from the keyboard, and where focus lands when a submit is refused before it
 * leaves the browser.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PublishForm } from "./publish-form";
import { CONSENT_LABELS } from "@/app/_lib/consent/messages";
import { CITY_IDS } from "@/app/_lib/profile-form/schema";
import { formOf, submittedFrom } from "@/testing/form-data";
import {
  CONSENT_REQUIRED,
  FEEDBACK_REGION_LABEL,
  FIELD_LABELS,
  PUBLISH_BUTTON,
  SKILL_NOT_LISTED_HELP,
  SKILL_REQUEST_BUTTON,
  SKILL_REQUEST_LABEL,
  SKILL_REQUEST_REQUIRED,
  SKILL_REQUEST_SENT,
  SKILL_REQUIRED,
  SKILLS_AT_MAXIMUM,
  summaryHeading,
} from "@/app/_lib/profile-form/messages";

const { publishProfile, requestSkill } = vi.hoisted(() => ({
  publishProfile: Object.assign(vi.fn(), { bind: () => vi.fn() }),
  requestSkill: vi.fn(),
}));

vi.mock("../actions", () => ({ publishProfile, requestSkill }));

const vocabulary = [
  { slug: "home-cooking", labelEs: "Cocinar almuerzos y comida casera" },
  { slug: "baking-and-pastry", labelEs: "Panadería y repostería" },
  { slug: "child-care", labelEs: "Cuidar niños por horas" },
  { slug: "plumbing", labelEs: "Arreglar tuberías y baños" },
  { slug: "painting", labelEs: "Pintar casas y apartamentos" },
  { slug: "gardening", labelEs: "Jardinería y poda de plantas" },
  { slug: "welding", labelEs: "Soldadura y trabajos en hierro" },
];

function renderForm() {
  return render(
    <PublishForm
      vocabulary={vocabulary}
      prefill={{ fullName: "" }}
      consentVersions={{ notice: "2026-08-30", authorization: "2026-08-30" }}
    />,
  );
}

/**
 * The form a native submit posts, reached from its submit button — a `<form>`
 * with no accessible name has no role of its own — and what the browser's own
 * serialiser would send from it. That is the whole of the no-JavaScript
 * question, asked of the browser rather than of the markup.
 */
const publishButton = () => screen.getByRole<HTMLButtonElement>("button", { name: PUBLISH_BUTTON });
const posted = () => submittedFrom(publishButton());

describe("the form", () => {
  it("keeps a native action and a named control for every field", async () => {
    const user = userEvent.setup();
    renderForm();

    expect(formOf(publishButton())).toHaveAttribute("action");

    // A radio or a checkbox posts only once chosen, so each is chosen before
    // asking what it sends — which also proves the value each one carries.
    // Every city in turn, since a radio group posts the one that is chosen.
    const cities: (FormDataEntryValue | null)[] = [];
    for (const city of screen.getAllByRole("radio")) {
      // Sequential on purpose: each pick replaces the last.
      // oxlint-disable-next-line no-await-in-loop
      await user.click(city);
      cities.push(posted().get("city"));
    }
    expect(cities.toSorted()).toEqual([...CITY_IDS].toSorted());

    // Six Skills, the most she can hold; the seventh is posted by its own case
    // below, so between them every entry is shown to post its own slug.
    for (const entry of vocabulary.slice(0, 6)) {
      // oxlint-disable-next-line no-await-in-loop
      await user.click(screen.getByRole("checkbox", { name: entry.labelEs }));
    }
    await user.click(screen.getByRole("checkbox", { name: CONSENT_LABELS.AUTHORIZATION_CHECKBOX }));

    const form = posted();
    for (const name of ["fullName", "firstName", "lastInitial", "headline", "phone", "about"]) {
      expect(form.has(name), name).toBe(true);
    }
    expect(form.getAll("workHistory").length).toBeGreaterThan(0);
    expect(form.getAll("skillSlugs").toSorted()).toEqual(
      vocabulary
        .slice(0, 6)
        .map((entry) => entry.slug)
        .toSorted(),
    );
    expect(form.get("consent")).toBe("true");
  });

  it("carries no hidden inputs at all", () => {
    renderForm();

    // Untouched, every choice is unchosen and posts nothing, so what is left is
    // exactly the fields she types. A hidden input would be one more key.
    expect([...new Set(posted().keys())].toSorted()).toEqual([
      "about",
      "firstName",
      "fullName",
      "headline",
      "lastInitial",
      "phone",
      "workHistory",
    ]);
  });

  it("moves focus to the summary, with the count first, when the browser refuses a submit", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: PUBLISH_BUTTON }));

    const summary = await screen.findByRole("alert", { name: FEEDBACK_REGION_LABEL });
    expect(summary).toHaveFocus();
    expect(summary).toHaveTextContent(summaryHeading(8));
    expect(summary).toHaveTextContent(SKILL_REQUIRED);
    expect(summary).toHaveTextContent(CONSENT_REQUIRED);
    expect(publishProfile).not.toHaveBeenCalled();
  });

  /**
   * **A summary item has to point at an element**, and a summary pointing at
   * nothing is worse than no summary. The checkbox takes the form's consent id
   * rather than minting its own, which is what lets this link land (#250).
   */
  it("links the summary's consent item to the checkbox", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: PUBLISH_BUTTON }));

    const link = await screen.findByRole("link", { name: FIELD_LABELS.consent });
    // The anchor lands on what the checkbox's label labels — found through that
    // association, the way assistive technology finds it.
    const labelled = screen.getAllByLabelText(CONSENT_LABELS.AUTHORIZATION_CHECKBOX);
    expect(labelled.map((element) => `#${element.id}`)).toContain(link.getAttribute("href"));
  });
});

describe("the Skill picker", () => {
  // Arrow keys and Home/End are this component's own; Space toggling is Base
  // UI's. Both are verified against a real browser at seam 3 as well — what
  // this pins is the focus rule, driven with the raw event because user-event
  // under happy-dom does not deliver a keydown to a capture-phase listener.
  it("moves focus between entries with the arrow keys, Home and End", () => {
    renderForm();

    const first = screen.getByRole("checkbox", { name: vocabulary[0]!.labelEs });
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowDown" });
    const second = screen.getByRole("checkbox", { name: vocabulary[1]!.labelEs });
    expect(second).toHaveFocus();

    fireEvent.keyDown(second, { key: "End" });
    const last = screen.getByRole("checkbox", { name: vocabulary.at(-1)!.labelEs });
    expect(last).toHaveFocus();

    fireEvent.keyDown(last, { key: "Home" });
    expect(first).toHaveFocus();
  });

  // The list is 91 entries in production. As plain checkboxes that is 91 tab
  // stops between this group and the next field, which is the whole reason
  // the arrow keys above exist — so the tab stop being *one* is the half
  // worth pinning, not the arrows on their own.
  it("is a single tab stop, which follows the entry she last moved to", () => {
    renderForm();

    const entries = vocabulary.map((entry) =>
      screen.getByRole("checkbox", { name: entry.labelEs }),
    );
    const tabbable = () => entries.filter((entry) => entry.getAttribute("tabindex") === "0");

    expect(tabbable()).toEqual([entries[0]]);

    entries[0]!.focus();
    fireEvent.keyDown(entries[0]!, { key: "ArrowDown" });

    expect(tabbable()).toEqual([entries[1]]);
  });

  // Greying the rest out at six is what this replaced: it stranded focus on an
  // inert control, where Space did nothing and the next Tab left the group
  // with no way back to what she had picked. Nothing she can reach is
  // disabled now, so the ceiling has to be said rather than shown.
  it("refuses a seventh out loud, and leaves every entry reachable", async () => {
    const user = userEvent.setup();
    renderForm();

    for (const entry of vocabulary.slice(0, 6)) {
      // Sequential on purpose: each pick changes what the next one costs.
      // oxlint-disable-next-line no-await-in-loop
      await user.click(screen.getByRole("checkbox", { name: entry.labelEs }));
    }

    const seventh = screen.getByRole("checkbox", { name: vocabulary[6]!.labelEs });
    expect(seventh).toBeEnabled();
    // The half a submit reads is the native input behind the styled control.
    // It is `aria-hidden`, so it is reached with `hidden: true` — still the
    // accessibility tree's own query — and told apart by the value it posts.
    // Enabled at the ceiling, or giving one back could not free it.
    const native = screen
      .getAllByRole<HTMLInputElement>("checkbox", { hidden: true })
      .find((input) => input.value === vocabulary[6]!.slug);
    expect(native).toBeEnabled();

    await user.click(seventh);

    expect(seventh).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("alert", { name: "" })).toHaveTextContent(SKILLS_AT_MAXIMUM);
    // Refused in what is posted too, not only in what is shown.
    expect(posted().getAll("skillSlugs")).not.toContain("welding");
  });

  it("takes the seventh once she gives one back", async () => {
    const user = userEvent.setup();
    renderForm();

    for (const entry of vocabulary.slice(0, 6)) {
      // oxlint-disable-next-line no-await-in-loop
      await user.click(screen.getByRole("checkbox", { name: entry.labelEs }));
    }
    await user.click(screen.getByRole("checkbox", { name: vocabulary[0]!.labelEs }));

    const seventh = screen.getByRole("checkbox", { name: vocabulary[6]!.labelEs });
    await user.click(seventh);

    expect(seventh).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByText(SKILLS_AT_MAXIMUM)).toBeNull();
    // The native input behind the styled control is what a submit reads, and it
    // was never disabled: once taken, the seventh is posted.
    expect(posted().getAll("skillSlugs")).toContain("welding");
  });

  it("narrows the list from the filter box, folding accents", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByRole("searchbox"), "panaderia");

    expect(screen.getByRole("checkbox", { name: "Panadería y repostería" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: vocabulary[0]!.labelEs })).toBeNull();
  });

  it("reaches the not-on-the-list option and says what it does", async () => {
    const user = userEvent.setup();
    renderForm();

    const option = screen.getByRole("checkbox", { name: /está en la lista/i });
    await user.click(option);

    expect(option).toHaveAccessibleDescription(SKILL_NOT_LISTED_HELP);
  });
});

/**
 * The request itself, which is story 3's whole point: she asks **from inside the
 * form**, and nothing about the form moves.
 *
 * These belong here rather than at seam 3 for the reason the rest of this file
 * does: what a running server cannot cheaply show is the *keyboard path* to a
 * control that only exists once hydrated, and whether the answer reaches the
 * accessibility tree at all.
 */
async function openTheRequest(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("checkbox", { name: /está en la lista/i }));
  return screen.getByRole<HTMLInputElement>("textbox", { name: SKILL_REQUEST_LABEL });
}

describe("asking for a Skill that is not on the list", () => {
  beforeEach(() => {
    requestSkill.mockReset();
    // The `useActionState` contract: given the previous state and the payload,
    // answer the next state. The default is a request that lands.
    requestSkill.mockResolvedValue({ data: { requested: true } });
  });

  /**
   * **The acceptance criterion's own sentence**: the option is reachable and
   * operable from the keyboard alone. It keeps a tab stop of its own — the roving
   * index above covers the vocabulary entries and deliberately not this control —
   * and the field and the button it reveals are the next two stops, typed into
   * and pressed with no pointer.
   *
   * **The one pointer event is the toggle, and it is an environment limit rather
   * than a gap in the assertion.** Base UI renders the control as a
   * `span[role="checkbox"]` and handles Space itself; `user.keyboard(" ")` on a
   * span synthesises no activation under happy-dom, so pressing it here would
   * assert the DOM environment rather than the product. Space on this control is
   * verified against a real browser at seam 3. What this test owns is the part a
   * browser run cannot show cheaply: that every control in the path is in the tab
   * order, in the order a person meets them.
   */
  it("is reachable and operable from the keyboard alone", async () => {
    const user = userEvent.setup();
    renderForm();

    const option = screen.getByRole("checkbox", { name: /está en la lista/i });
    option.focus();
    expect(option).toHaveFocus();
    expect(option).not.toHaveAttribute("tabindex", "-1");

    await user.click(option);

    await user.tab();
    expect(screen.getByRole("textbox", { name: SKILL_REQUEST_LABEL })).toHaveFocus();

    await user.keyboard("Arreglo máquinas de coser");
    await user.tab();
    expect(screen.getByRole("button", { name: SKILL_REQUEST_BUTTON })).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(requestSkill).toHaveBeenCalled();
  });

  /**
   * **Nothing she typed moves, and she is still on the form.** The form's own
   * fields are read back after the request lands: a request that navigated, reset
   * the form or re-rendered it from an action result would show up here as an
   * empty field.
   */
  it("leaves the rest of the form exactly as she left it", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByRole("textbox", { name: /línea sobre tu trabajo/i }), "Cocino");
    const field = await openTheRequest(user);
    await user.type(field, "Arreglo máquinas de coser");
    await user.click(screen.getByRole("button", { name: SKILL_REQUEST_BUTTON }));

    expect(screen.getByRole("textbox", { name: /línea sobre tu trabajo/i })).toHaveValue("Cocino");
    expect(publishProfile).not.toHaveBeenCalled();
  });

  it("says it arrived, politely, and clears the field", async () => {
    const user = userEvent.setup();
    renderForm();

    const field = await openTheRequest(user);
    await user.type(field, "Arreglo máquinas de coser");
    // Asserted before the click, so "cleared" is a change rather than a field
    // that never held anything.
    expect(field).toHaveValue("Arreglo máquinas de coser");

    await user.click(screen.getByRole("button", { name: SKILL_REQUEST_BUTTON }));

    // The element carrying the sentence, and the role it carries it with: a
    // polite region, because nothing is waiting on her reading it.
    expect(await screen.findByText(SKILL_REQUEST_SENT)).toHaveAttribute("role", "status");
    expect(field).toHaveValue("");
  });

  /**
   * **A second request, after a first one landed** — the case seam 3 found and
   * these tests did not, because they sent once.
   *
   * The field's value was derived as `sent ? "" : text`, which empties it on
   * success and then keeps emptying it: `sent` stays true for as long as the last
   * result does, so the controlled input was pinned empty and nothing could be
   * typed into it again. Two Skills missing from the list is not an exotic case —
   * it is the second sentence of the same conversation.
   */
  it("takes a second request after the first one landed", async () => {
    const user = userEvent.setup();
    renderForm();

    const field = await openTheRequest(user);
    await user.type(field, "Arreglo máquinas de coser");
    await user.click(screen.getByRole("button", { name: SKILL_REQUEST_BUTTON }));
    await screen.findByText(SKILL_REQUEST_SENT);

    await user.type(field, "Coso en máquina plana");
    expect(field).toHaveValue("Coso en máquina plana");

    await user.click(screen.getByRole("button", { name: SKILL_REQUEST_BUTTON }));

    const sent = requestSkill.mock.calls.at(-1)?.[1] as FormData;
    expect(sent.get("text")).toBe("Coso en máquina plana");
  });

  /**
   * **A refusal interrupts.** She asked for something and this is the answer, so
   * it is an `alert` rather than the polite region — the same distinction the
   * seventh-Skill refusal above makes.
   */
  it("speaks the refusal the server sent, whatever refused it", async () => {
    const user = userEvent.setup();
    requestSkill.mockResolvedValue({
      serverError: { code: "skill_request_refused", message: "Quita el «300 123 4567»." },
    });
    renderForm();

    const field = await openTheRequest(user);
    await user.type(field, "Arreglo estufas, 300 123 4567");
    await user.click(screen.getByRole("button", { name: SKILL_REQUEST_BUTTON }));

    // The sentence and the role it interrupts with, on the same element — the
    // form has other `alert`s, and which one carries this is the assertion.
    expect(await screen.findByText(/300 123 4567/)).toHaveAttribute("role", "alert");
  });

  /** An empty field costs no round trip, and says so where the field is. */
  it("refuses an empty request in the browser", async () => {
    const user = userEvent.setup();
    renderForm();

    await openTheRequest(user);
    await user.click(screen.getByRole("button", { name: SKILL_REQUEST_BUTTON }));

    expect(requestSkill).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: SKILL_REQUEST_LABEL })).toHaveAccessibleDescription(
      new RegExp(SKILL_REQUEST_REQUIRED),
    );
  });

  /**
   * **No second `<form>`, and no `formAction` on the button.** Both would be
   * illegal or wrong inside the publishing form — HTML does not nest forms, and a
   * button carrying its own `formAction` submits the form around it, which
   * unhydrated would post her whole draft to the request action.
   */
  it("adds no second form and no submit button", async () => {
    const user = userEvent.setup();
    renderForm();

    const field = await openTheRequest(user);
    const publish = screen.getByRole<HTMLButtonElement>("button", { name: PUBLISH_BUTTON });
    const request = screen.getByRole<HTMLButtonElement>("button", { name: SKILL_REQUEST_BUTTON });

    // A control's `form` is its nearest form, so a second `<form>` around the
    // request would make these a different object from the publishing form.
    expect(field.form).toBe(publish.form);
    expect(request.form).toBe(publish.form);
    expect(request).not.toHaveAttribute("formaction");
    expect(request).toHaveAttribute("type", "button");
  });
});
