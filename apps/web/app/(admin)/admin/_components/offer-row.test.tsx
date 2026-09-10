/**
 * The Offer row, which is where this section's design actually lives.
 *
 * **Rendered inside the real branch rather than on its own**, because two of the
 * things under test are properties of a *list* — that every row offers the same
 * two affordances in the same order, and that deciding one hands the keyboard to
 * the next. A row tested alone can satisfy both vacuously.
 *
 * **Queried by role.** A queue an Admin works by keyboard is exactly where a
 * control that never told the accessibility tree it exists would hide.
 */

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OfferRow } from "./offer-row";
import { SourceBranch } from "./queue";
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
import type { QueueBranch, QueueItem } from "../_lib/queue-sources";

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

function anItem(id: string, hirer: string, worker: string): QueueItem {
  return {
    id,
    summary: `De ${hirer} (nombre sin comprobar) para ${worker}.`,
    fields: [
      { label: OFFER_WORK_FIELD, value: `Trabajo de ${hirer}` },
      { label: OFFER_PAY_FIELD, value: "$120.000 por el día" },
      { label: OFFER_WHEN_FIELD, value: "Sábado desde las 7" },
    ],
    arrivedAt: new Date("2026-09-07T10:00:00.000Z"),
  };
}

const FIRST = anItem("0199a1f0-2b3c-7def-8000-0123456789ab", "Carlos", "Ana M");
const SECOND = anItem("0199a1f0-2b3c-7def-8000-0123456789ac", "Lucía", "Marta R");

const branch: QueueBranch = {
  items: [FIRST, SECOND],
  total: 2,
  oldestArrivedAt: FIRST.arrivedAt,
};

const aBranch = () => render(<SourceBranch branch={branch} Item={OfferRow} />);

/**
 * The row an Offer's summary line sits in: the innermost list item carrying it.
 * Document order puts an ancestor before its descendants, so the last match is
 * the innermost one.
 */
const rowFor = (item: QueueItem) => {
  const row = screen
    .getAllByRole("listitem")
    .findLast((listitem) => within(listitem).queryByText(item.summary) !== null);
  if (row === undefined) throw new Error(`No row carries "${item.summary}".`);
  return row;
};

beforeEach(() => {
  deliverOffer.mockReset();
  rejectOffer.mockReset();
  boundToDeliver.mockReset();
  boundToReject.mockReset();
  deliverOffer.mockResolvedValue({ data: { workerFirstName: "Ana" } });
  rejectOffer.mockResolvedValue({ data: { offerId: FIRST.id } });
});

/**
 * **Nothing is acted on unread**, which on this source is the whole control: the
 * contact-detail rejector is a speed bump and this person is what stands between
 * a stranger's message and a Worker's phone. So the three things he wrote are on
 * the row, whole, beside the line naming both people.
 */
it("renders each Offer in full, with both people named", () => {
  aBranch();

  for (const item of [FIRST, SECOND]) {
    const row = within(rowFor(item));
    expect(row.getByText(item.summary)).toBeInTheDocument();

    for (const field of item.fields ?? []) {
      expect(row.getByText(field.label)).toBeInTheDocument();
      expect(row.getByText(field.value)).toBeInTheDocument();
    }
  }
});

/**
 * **A fixed row shape: the same affordances, in the same position, every time.**
 * This person sees these rows more than any other screen in the product, and a
 * control whose position depends on the row is a control that gets pressed by
 * mistake on the twentieth one. Asserted as an ordered list per row rather than
 * as presence, because presence is satisfied by two buttons in either order.
 */
it("gives every row the same two decisions in the same order", () => {
  aBranch();

  for (const item of [FIRST, SECOND]) {
    const names = within(rowFor(item))
      .getAllByRole("button")
      .map((button) => button.textContent);

    expect(names).toEqual([DELIVER_OFFER_SUBMIT, REJECT_OFFER_SUBMIT]);
  }
});

/**
 * **No bulk action, here or anywhere on this queue.** Deciding many in one click
 * is the mechanism by which something reaches a person unread — so the count of
 * controls is exactly two per row and nothing sits outside the rows.
 */
it("offers no control that decides more than one Offer", () => {
  aBranch();

  expect(screen.getAllByRole("button")).toHaveLength(4);
});

/**
 * **The id is bound to both decisions and is nowhere in the markup** (ADR-0015):
 * it travels with the submit, nobody types it, and React encodes it into the
 * action reference.
 *
 * The hidden-input half is asked of the browser's own serialiser: each decision
 * button's `form` is what a native submit from it posts, and a mirrored id would
 * be a key there.
 */
it("binds the Offer to each decision instead of mirroring it into a form", () => {
  aBranch();

  expect(boundToDeliver.mock.calls.flat()).toEqual([FIRST.id, SECOND.id]);
  expect(boundToReject.mock.calls.flat()).toEqual([FIRST.id, SECOND.id]);

  const decisions = [DELIVER_OFFER_SUBMIT, REJECT_OFFER_SUBMIT].flatMap((name) =>
    screen.getAllByRole<HTMLButtonElement>("button", { name }),
  );
  expect(decisions).toHaveLength(4);
  for (const { form } of decisions) {
    expect(form === null ? null : [...new FormData(form).keys()]).toEqual([]);
  }
});

/**
 * **A decided row keeps its place and stops being actionable.** Removing it would
 * take the outcome off the screen and shift every row below it under a cursor
 * that is mid-queue; leaving the buttons live would invite a second press against
 * a state the server has already moved.
 */
it.each([
  [DELIVER_OFFER_SUBMIT, () => offerDelivered("Ana")],
  [REJECT_OFFER_SUBMIT, () => OFFER_REJECTED],
])("says what it did after %s and closes the row", async (control, announced) => {
  const user = userEvent.setup();
  aBranch();

  await user.click(within(rowFor(FIRST)).getByRole("button", { name: control }));

  expect(await screen.findByText(announced())).toBeInTheDocument();

  const decided = within(rowFor(FIRST));
  expect(decided.getByText(OFFER_ROW_RESOLVED)).toBeInTheDocument();
  expect(decided.queryAllByRole("button")).toEqual([]);
  // The row below is untouched: one decision decides one Offer.
  expect(within(rowFor(SECOND)).getAllByRole("button")).toHaveLength(2);
});

/**
 * **Twenty decisions is twenty keystrokes, not twenty re-orientations.** Focus
 * goes to the next row still waiting rather than back to the row just finished
 * with — and it lands on the line an Admin has to read rather than on a control,
 * because a keyboard put straight onto *Entregar* is a keyboard one press away
 * from delivering something unread.
 */
it("hands the keyboard to the next row waiting", async () => {
  const user = userEvent.setup();
  aBranch();

  await user.click(within(rowFor(FIRST)).getByRole("button", { name: DELIVER_OFFER_SUBMIT }));

  expect(await screen.findByText(offerDelivered("Ana"))).toBeInTheDocument();
  expect(screen.getByText(SECOND.summary)).toHaveFocus();
});

/**
 * **The last row has nowhere onward**, and dropping focus to the document would
 * cost exactly the re-orientation the rule exists to prevent — so it stays on the
 * outcome.
 */
it("keeps focus on the outcome when the branch is finished", async () => {
  const user = userEvent.setup();
  aBranch();

  await user.click(within(rowFor(SECOND)).getByRole("button", { name: REJECT_OFFER_SUBMIT }));

  expect(await screen.findByText(OFFER_REJECTED)).toHaveFocus();
});

/**
 * **A refusal moves nobody.** An Offer somebody else already handled leaves the
 * Admin on the row they are still looking at, with focus on the sentence
 * explaining why — and with the decision still open, because nothing happened.
 */
it("stays on a row whose decision was refused", async () => {
  const user = userEvent.setup();
  deliverOffer.mockResolvedValue({
    serverError: {
      code: "admin_offer_not_pending",
      message: "Esa propuesta ya no está esperando revisión. Vuelve a cargar la página.",
    },
  });
  aBranch();

  await user.click(within(rowFor(FIRST)).getByRole("button", { name: DELIVER_OFFER_SUBMIT }));

  const refusal = await screen.findByText(
    "Esa propuesta ya no está esperando revisión. Vuelve a cargar la página.",
  );
  expect(refusal).toHaveFocus();
  expect(within(rowFor(FIRST)).getAllByRole("button")).toHaveLength(2);
});

/**
 * **A row that has met two refusals says what the second one was.**
 *
 * Two `useActionState`s means two results that both persist, so a row that merged
 * them by taking whichever is non-empty would go on announcing the first refusal
 * after the second — telling an Admin the wrong thing about what they just
 * pressed. Both refusals happen to resolve to the same two sentences today, which
 * is exactly why this is a test rather than a comment.
 */
it("announces the decision that was just refused, not the one before it", async () => {
  const user = userEvent.setup();
  deliverOffer.mockResolvedValue({ serverError: { message: "La entrega se negó." } });
  rejectOffer.mockResolvedValue({ serverError: { message: "El rechazo se negó." } });
  aBranch();

  const row = within(rowFor(FIRST));
  await user.click(row.getByRole("button", { name: DELIVER_OFFER_SUBMIT }));
  expect(await screen.findByText("La entrega se negó.")).toBeInTheDocument();

  await user.click(row.getByRole("button", { name: REJECT_OFFER_SUBMIT }));

  expect(await screen.findByText("El rechazo se negó.")).toHaveFocus();
  expect(screen.queryByText("La entrega se negó.")).toBeNull();
});
