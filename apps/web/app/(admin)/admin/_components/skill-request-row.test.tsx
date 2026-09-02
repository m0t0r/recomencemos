/**
 * The promote row, which is the one part of this ticket a running server cannot
 * show today: reaching `/admin` needs a session stamped by the Admin's
 * second-factor screen, and that screen is its own open ticket. So the row's
 * behaviour is pinned here, and the act behind it at seam 2.
 *
 * **Queried by role.** A row an Admin works through by keyboard is exactly where
 * a control that never told the accessibility tree it exists would hide.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SkillRequestRow } from "./skill-request-row";
import {
  PROMOTE_LABEL_LABEL,
  PROMOTE_SLUG_LABEL,
  PROMOTE_SUBMIT,
  skillPromoted,
} from "../_lib/messages";
import type { QueueItem } from "../_lib/queue-sources";

/**
 * `bind` is the action's real surface here, so the double carries one: the row
 * binds the request id and this is what records which id it bound.
 */
const { promoteSkill, bound } = vi.hoisted(() => {
  const action = vi.fn();
  const record = vi.fn();
  Object.assign(action, {
    bind: (_this: unknown, requestId: string) => {
      record(requestId);
      return action;
    },
  });

  return { promoteSkill: action, bound: record };
});

vi.mock("../actions", () => ({ promoteSkill }));

const item: QueueItem = {
  id: "7",
  summary: "Reparo máquinas de coser industriales",
  arrivedAt: new Date("2026-09-01T10:00:00.000Z"),
};

beforeEach(() => {
  promoteSkill.mockReset();
  bound.mockReset();
  promoteSkill.mockResolvedValue({ data: { labelEs: "Arreglo máquinas de coser" } });
});

/**
 * **Her words, in full.** The spec's rule for every branch is that it renders in
 * full so nothing is acted on unread, and this source is where that bites: the
 * Admin is about to translate this sentence into a label the whole product
 * renders, so a truncated or summarised row would be a translation of something
 * nobody saw.
 */
it("renders the request as she wrote it", () => {
  render(<SkillRequestRow item={item} />);

  expect(screen.getByText(item.summary)).toBeInTheDocument();
});

/**
 * **The request id is bound, and it is nowhere in the markup** (ADR-0015): a
 * hidden input mirroring a value nobody typed is the shape that rule replaces,
 * and this row is the one the four remaining queue sections will copy.
 *
 * The hidden-input half is asserted with a raw selector on purpose — the same
 * escape hatch `sign-in-form.test.tsx` uses, and for the identical reason: a
 * hidden input has no accessible role, so its **absence** is unassertable through
 * the accessibility tree.
 */
it("binds the request it is about to promote instead of mirroring it into the form", async () => {
  const user = userEvent.setup();
  const { container } = render(<SkillRequestRow item={item} />);

  expect(bound).toHaveBeenCalledWith("7");
  expect(container.querySelector('input[type="hidden"]')).toBeNull();

  await user.type(screen.getByRole("textbox", { name: PROMOTE_SLUG_LABEL }), "sewing-repair");
  await user.type(
    screen.getByRole("textbox", { name: PROMOTE_LABEL_LABEL }),
    "Arreglo máquinas de coser",
  );
  await user.click(screen.getByRole("button", { name: PROMOTE_SUBMIT }));

  const sent = promoteSkill.mock.calls.at(-1)?.[1] as FormData;
  expect(sent.get("slug")).toBe("sewing-repair");
  expect(sent.get("labelEs")).toBe("Arreglo máquinas de coser");
});

/**
 * **The entry is read back, and the form goes away.** One promotion is one entry;
 * the Admin typed two strings a moment ago and this is the only place the pair
 * that landed is quoted back. The form closing is what stops the same row being
 * promoted twice from the same screen — the lock in the domain is what stops it
 * for real, and this is what stops it being tried.
 */
it("quotes the entry back and closes the form", async () => {
  const user = userEvent.setup();
  render(<SkillRequestRow item={item} />);

  await user.type(screen.getByRole("textbox", { name: PROMOTE_SLUG_LABEL }), "sewing-repair");
  await user.type(
    screen.getByRole("textbox", { name: PROMOTE_LABEL_LABEL }),
    "Arreglo máquinas de coser",
  );
  await user.click(screen.getByRole("button", { name: PROMOTE_SUBMIT }));

  expect(await screen.findByText(skillPromoted("Arreglo máquinas de coser"))).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: PROMOTE_SUBMIT })).toBeNull();
});

/**
 * **Focus lands on what happened, not at the top of the page.** The queue is
 * worked top to bottom by one person; the announcement beside the control is
 * where the work was, and putting focus there also puts the outcome in front of a
 * screen-reader user before the next row.
 */
it("moves focus to the announcement, whichever way it went", async () => {
  const user = userEvent.setup();
  promoteSkill.mockResolvedValue({
    serverError: { code: "admin_skill_request_resolved", message: "Otra persona ya la resolvió." },
  });
  render(<SkillRequestRow item={item} />);

  await user.type(screen.getByRole("textbox", { name: PROMOTE_SLUG_LABEL }), "sewing-repair");
  await user.type(
    screen.getByRole("textbox", { name: PROMOTE_LABEL_LABEL }),
    "Arreglo máquinas de coser",
  );
  await user.click(screen.getByRole("button", { name: PROMOTE_SUBMIT }));

  const announcement = await screen.findByText("Otra persona ya la resolvió.");
  expect(announcement).toHaveFocus();
  // Refused, so the row is still workable: the request is still pending.
  expect(screen.getByRole("button", { name: PROMOTE_SUBMIT })).toBeInTheDocument();
});
