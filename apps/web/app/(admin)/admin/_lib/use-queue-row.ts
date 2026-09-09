"use client";

/**
 * What every row in the queue does after the Admin decides it: say what happened,
 * and hand the keyboard on.
 *
 * **The third instance, which is when `sessions-panel.tsx` said to extract one.**
 * That file wrote the rule down and deliberately shipped no hook — _"one caller
 * does not justify an abstraction, and a hook written for a queue item that does
 * not exist would be guessing at its shape"_. The Skill request row copied it,
 * the Offer row copied it again, and this is the third: the shape is no longer a
 * guess, and the two rows that have it were already a size apart.
 *
 * **The rule itself changes here, and that is the substance rather than the
 * refactor.** A panel is a control that stays put, so focus returned to it. A
 * *row* is a position in a list that the Admin is working top to bottom, and
 * returning focus to the row just decided leaves them one keystroke from pressing
 * something on a row they have finished with. So focus goes to the **next row**
 * that still needs a decision.
 *
 * **Announcing and focusing are two different jobs, and separating them is what
 * made the change possible.** Both earlier callers announced *by focusing* the
 * status region, which welds the outcome to the cursor: move the cursor onward
 * and the outcome goes unspoken. A polite live region announces on its own, so
 * the outcome is spoken where the Admin left it and the keyboard is already on
 * the next row when they hear it.
 *
 * **A refusal does not move anybody.** Only a decision that landed hands the
 * keyboard on; an Offer somebody else already handled leaves the Admin on the row
 * they are still looking at, with focus on the sentence explaining why — which is
 * the panel's rule, correctly, for the case where nothing moved.
 */

import { useEffect, useRef } from "react";

/**
 * What an element this hook may focus wears, so that it shows it has focus.
 *
 * A programmatic focus target with no visible ring is a keyboard user's position
 * lost, which is the whole thing the handoff exists to protect. It lives beside
 * the hook rather than in either row because it is a property of *being
 * focusable by this mechanism* rather than of either surface.
 */
export const QUEUE_FOCUSABLE_LINE =
  "focus-visible:ring-ring/50 text-foreground rounded-md text-sm leading-5 outline-none focus-visible:ring-[3px]";

/**
 * The shape of a `useActionState` result, read for one bit: did anything come
 * back.
 *
 * Structural and `unknown`-valued on purpose — every row's action returns a
 * different `data` and a different `validationErrors`, and this hook has no
 * business knowing either. What it needs is the three keys next-safe-action
 * answers with.
 */
export interface QueueRowResult {
  readonly data?: unknown;
  readonly serverError?: unknown;
  readonly validationErrors?: unknown;
}

/**
 * The next row still waiting on a decision, or nothing at the end of the branch.
 *
 * **It walks the rendered list rather than an index passed in**, because the row
 * does not know its own position and giving it one would make every row depend on
 * the branch that holds it. The list is the DOM's, which is the same list the
 * Admin is looking at — including, in the failing case, a row a colleague's
 * decision has not yet removed.
 *
 * **Rows already decided are stepped over.** An Admin who works two rows out of
 * order should not be handed back to the one they finished with, and a decided
 * row has nothing left to press.
 *
 * **Four attributes are the contract, and it is spelled out because the failure is
 * silent.** `data-queue-list` on the branch, `data-queue-row` on each row's root,
 * `data-resolved` once that row is decided, and `data-queue-anchor` on the line
 * focus lands on. Any one of them missing degrades to the announcement fallback,
 * which is indistinguishable from "this was the last row" — so the marker on the
 * list is named rather than inferred from a `ul`, which a section could stop being
 * without anybody noticing. `_components/queue.tsx` carries the first and
 * `offer-row.tsx` and `skill-request-row.tsx` carry the rest; the case in
 * `offer-row.test.tsx` renders the real branch around the real row, so a drift in
 * any of the four is red rather than quiet.
 */
function nextUndecidedAnchor(row: HTMLElement): HTMLElement | null {
  const list = row.closest("[data-queue-list]");
  if (!list) return null;

  const rows = [...list.querySelectorAll<HTMLElement>("[data-queue-row]")];
  const position = rows.indexOf(row);
  if (position < 0) return null;

  const next = rows.slice(position + 1).find((each) => each.dataset.resolved !== "true");

  return next?.querySelector<HTMLElement>("[data-queue-anchor]") ?? null;
}

/**
 * The two refs a queue row needs: one on its root, one on its announcement.
 *
 * The announcement ref is what a refusal focuses, and it is also the fallback
 * when the decided row was the last one in the branch — there is nowhere onward,
 * and dropping focus to the document would cost exactly the re-orientation this
 * exists to prevent.
 */
export function useQueueRow(result: QueueRowResult) {
  const rowRef = useRef<HTMLDivElement>(null);
  const announcementRef = useRef<HTMLParagraphElement>(null);

  /**
   * Read from `result` rather than from a derived boolean: a boolean stays `true`
   * across a second outcome, so focus would move once and never again. `result`
   * is a fresh object per dispatch.
   */
  useEffect(() => {
    if (result.data) {
      const onward = rowRef.current ? nextUndecidedAnchor(rowRef.current) : null;
      (onward ?? announcementRef.current)?.focus();
      return;
    }

    if (result.serverError ?? result.validationErrors) announcementRef.current?.focus();
  }, [result]);

  return { rowRef, announcementRef };
}
