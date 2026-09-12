/**
 * The Offer row, on its own.
 *
 * **What is a property of the list — that deciding one row hands the keyboard to
 * the next, and that a closed row offers nothing to press — is tested in
 * `queue-table.test.tsx`**, around the real row. What is here is what is true of
 * one Offer wherever it renders: in full, two decisions in a fixed order, the id
 * bound rather than mirrored, and an outcome that is said.
 *
 * **Queried by role.** A queue an Admin works by keyboard is exactly where a
 * control that never told the accessibility tree it exists would hide.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fieldNamesFrom } from "@/testing/form-data";
import { OfferRow } from "./offer-row";
import {
  DELIVER_OFFER_SUBMIT,
  offerDelivered,
  OFFER_PAY_FIELD,
  OFFER_REJECTED,
  OFFER_ROW_RESOLVED,
  OFFER_WHEN_FIELD,
  OFFER_WORK_FIELD,
  REJECT_OFFER_SUBMIT,
} from "../_lib/messages";
import type { QueueItem } from "../_lib/queue-sources";

/**
 * Both actions are doubles, and both carry a `bind` — that is the action's real
 * surface here, since the row binds the Offer's id rather than mirroring it into
 * the form. Each double records what it was bound to.
 */
const { deliverOffer, rejectOffer, boundToDeliver, boundToReject } = vi.hoisted(() => {
  // It captures nothing, and it cannot move out: `vi.hoisted` is lifted above
  // every statement in the file, so a helper at module scope would be read in its
  // temporal dead zone.
  // oxlint-disable-next-line unicorn/consistent-function-scoping
  const withBind = () => {
    const action = vi.fn();
    const record = vi.fn();
    Object.assign(action, {
      bind: (_this: unknown, offerId: string) => {
        record(offerId);
        return action;
      },
    });
    return [action, record] as const;
  };

  const [deliver, deliverRecord] = withBind();
  const [reject, rejectRecord] = withBind();

  return {
    deliverOffer: deliver,
    rejectOffer: reject,
    boundToDeliver: deliverRecord,
    boundToReject: rejectRecord,
  };
});

vi.mock("../actions", () => ({ deliverOffer, rejectOffer }));

const OFFER: QueueItem = {
  id: "0199a1f0-2b3c-7def-8000-0123456789ab",
  summary: "De Carlos (nombre sin comprobar) para Ana M.",
  fields: [
    { label: OFFER_WORK_FIELD, value: "Trabajo de Carlos" },
    { label: OFFER_PAY_FIELD, value: "$120.000 por el día" },
    { label: OFFER_WHEN_FIELD, value: "Sábado desde las 7" },
  ],
  arrivedAt: new Date("2026-09-07T10:00:00.000Z"),
};

const anOffer = () => render(<OfferRow item={OFFER} />);

beforeEach(() => {
  deliverOffer.mockReset();
  rejectOffer.mockReset();
  deliverOffer.mockResolvedValue({ data: { workerFirstName: "Ana" } });
  rejectOffer.mockResolvedValue({ data: { offerId: OFFER.id } });
});

/**
 * **Nothing is acted on unread**, which on this source is the whole control: the
 * contact-detail rejector is a speed bump and this person is what stands between
 * a stranger's message and a Worker's phone. So the three things he wrote are on
 * the row, whole, beside the line naming both people.
 */
it("renders the Offer in full, with both people named", () => {
  anOffer();

  expect(screen.getByText(OFFER.summary)).toBeInTheDocument();
  for (const field of OFFER.fields ?? []) {
    expect(screen.getByText(field.label)).toBeInTheDocument();
    expect(screen.getByText(field.value)).toBeInTheDocument();
  }
});

/**
 * **A fixed shape: the same affordances, in the same position, every time.**
 * Asserted as an ordered list rather than as presence, because presence is
 * satisfied by two buttons in either order.
 */
it("gives the two decisions in the same order, each with its key", () => {
  anOffer();

  const decisions = screen.getAllByRole("button");
  expect(decisions.map((button) => button.textContent)).toEqual([
    DELIVER_OFFER_SUBMIT,
    REJECT_OFFER_SUBMIT,
  ]);
  expect(decisions.map((button) => button.getAttribute("aria-keyshortcuts"))).toEqual(["a", "r"]);
});

/**
 * **The id is bound to both decisions and is nowhere in the markup** (ADR-0015):
 * it travels with the submit, nobody types it, and React encodes it into the
 * action reference. The hidden-input half is asked of the browser's own
 * serialiser.
 */
it("binds the Offer to each decision instead of mirroring it into a form", () => {
  anOffer();

  expect(boundToDeliver).toHaveBeenCalledWith(OFFER.id);
  expect(boundToReject).toHaveBeenCalledWith(OFFER.id);
  for (const decision of screen.getAllByRole<HTMLButtonElement>("button")) {
    expect(fieldNamesFrom(decision)).toEqual([]);
  }
});

/**
 * **A decided row keeps its place and stops being actionable.** Removing it would
 * take the outcome off the screen; leaving the buttons live would invite a second
 * press against a state the server has already moved.
 */
it.each([
  [DELIVER_OFFER_SUBMIT, () => offerDelivered("Ana")],
  [REJECT_OFFER_SUBMIT, () => OFFER_REJECTED],
])("says what it did after %s and closes the row", async (control, announced) => {
  const user = userEvent.setup();
  anOffer();

  await user.click(screen.getByRole("button", { name: control }));

  expect(await screen.findByText(announced())).toBeInTheDocument();
  expect(screen.getByText(OFFER_ROW_RESOLVED)).toBeInTheDocument();
  expect(screen.queryAllByRole("button")).toEqual([]);
});

/**
 * **With no list to hand on to, focus stays on the outcome** — the last-row rule,
 * which is also what a row rendered on its own does.
 */
it("keeps focus on the outcome when there is nowhere onward", async () => {
  const user = userEvent.setup();
  anOffer();

  await user.click(screen.getByRole("button", { name: DELIVER_OFFER_SUBMIT }));

  expect(await screen.findByText(offerDelivered("Ana"))).toHaveFocus();
});

/**
 * **A refusal moves nobody.** An Offer somebody else already handled leaves the
 * Admin on the row, with focus on the sentence explaining why — and with the
 * decision still open, because nothing happened.
 */
it("stays on a row whose decision was refused", async () => {
  const user = userEvent.setup();
  deliverOffer.mockResolvedValue({
    serverError: {
      code: "admin_offer_not_pending",
      message: "Esa propuesta ya no está esperando revisión. Vuelve a cargar la página.",
    },
  });
  anOffer();

  await user.click(screen.getByRole("button", { name: DELIVER_OFFER_SUBMIT }));

  const refusal = await screen.findByText(
    "Esa propuesta ya no está esperando revisión. Vuelve a cargar la página.",
  );
  expect(refusal).toHaveFocus();
  expect(screen.getAllByRole("button")).toHaveLength(2);
});

/**
 * **A row that has met two refusals says what the second one was.** Two
 * `useActionState`s means two results that both persist, so a row that merged
 * them by taking whichever is non-empty would go on announcing the first refusal
 * after the second.
 */
it("announces the decision that was just refused, not the one before it", async () => {
  const user = userEvent.setup();
  deliverOffer.mockResolvedValue({ serverError: { message: "La entrega se negó." } });
  rejectOffer.mockResolvedValue({ serverError: { message: "El rechazo se negó." } });
  anOffer();

  await user.click(screen.getByRole("button", { name: DELIVER_OFFER_SUBMIT }));
  expect(await screen.findByText("La entrega se negó.")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: REJECT_OFFER_SUBMIT }));

  expect(await screen.findByText("El rechazo se negó.")).toHaveFocus();
  expect(screen.queryByText("La entrega se negó.")).toBeNull();
});
