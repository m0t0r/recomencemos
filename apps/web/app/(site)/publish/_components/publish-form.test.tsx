/**
 * What a running server cannot show about the publishing form: the HTML that
 * survives with no JavaScript, the absence of hidden inputs, the Skill picker
 * from the keyboard, and where focus lands when a submit is refused before it
 * leaves the browser.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PublishForm } from "./publish-form";
import {
  CONSENT_REQUIRED,
  FEEDBACK_REGION_LABEL,
  PUBLISH_BUTTON,
  SKILL_REQUIRED,
  SKILLS_AT_MAXIMUM,
  summaryHeading,
} from "../_lib/messages";

const { publishProfile } = vi.hoisted(() => ({
  publishProfile: Object.assign(vi.fn(), { bind: () => vi.fn() }),
}));

vi.mock("../actions", () => ({ publishProfile }));

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

describe("the form", () => {
  it("keeps a native action and a named control for every field", () => {
    // The one place a raw DOM query is the right tool: "is there a `<form>`
    // with an `action`" is a question about the HTML that survives with no
    // JavaScript, not about the accessibility tree.
    const { container } = renderForm();
    const form = container.querySelector("form");

    expect(form?.getAttribute("action")).toBeTruthy();

    for (const name of ["fullName", "firstName", "lastInitial", "headline", "phone", "about"]) {
      expect(container.querySelector(`[name="${name}"]`)).not.toBeNull();
    }
    expect(container.querySelectorAll('input[name="city"]').length).toBe(3);
    expect(container.querySelectorAll('input[name="skillSlugs"]').length).toBe(vocabulary.length);
    expect(container.querySelector('input[name="consent"]')).not.toBeNull();
    expect(container.querySelectorAll('input[name="workHistory"]').length).toBeGreaterThan(0);
  });

  it("carries no hidden inputs at all", () => {
    // A hidden input has no accessible role by definition, so its absence is
    // unassertable through any query built on the accessibility tree.
    const { container } = renderForm();

    expect(container.querySelectorAll('input[type="hidden"]').length).toBe(0);
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

  it("stops at six and says so", async () => {
    const user = userEvent.setup();
    const { container } = renderForm();

    for (const entry of vocabulary.slice(0, 6)) {
      // Sequential on purpose: the seventh is disabled only once six are ticked.
      // oxlint-disable-next-line no-await-in-loop
      await user.click(screen.getByRole("checkbox", { name: entry.labelEs }));
    }

    // The half that decides what is posted is the hidden native input beside
    // the styled control — a hidden input has no role, so it is queried by
    // name and value.
    expect(container.querySelector('input[name="skillSlugs"][value="welding"]')).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: vocabulary[6]!.labelEs })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(screen.getByText(new RegExp(SKILLS_AT_MAXIMUM))).toBeInTheDocument();
  });

  it("narrows the list from the filter box, folding accents", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByRole("searchbox"), "panaderia");

    expect(screen.getByRole("checkbox", { name: "Panadería y repostería" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: vocabulary[0]!.labelEs })).toBeNull();
  });

  it("reaches the not-on-the-list option and says what it does today", async () => {
    const user = userEvent.setup();
    renderForm();

    const option = screen.getByRole("checkbox", { name: /está en la lista/i });
    await user.click(option);

    expect(option).toHaveAccessibleDescription(/Por ahora/);
  });
});
