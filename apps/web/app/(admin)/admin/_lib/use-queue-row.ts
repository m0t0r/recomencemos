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

import { createContext, useContext, useEffect, useRef } from "react";

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
 * How a decided row hands the keyboard on: the list that holds it moves its
 * cursor to the next row still waiting and focuses it, and answers `false` when
 * there is nowhere onward.
 *
 * **The list owns the handoff because the list owns the cursor.** This used to be
 * a walk of the rendered DOM — four `data-` attributes, from the decided row to
 * the next one's anchor — which worked while every row was open on a
 * single-source page. In the one table (#277) only the selected row is open, so
 * the next row's anchor is inside a detail that is `hidden` until the table
 * selects it; a walk cannot focus what the table has not shown yet. So the rule
 * stays here and the *where* moves to the component that knows it.
 *
 * **Absent means "no list"** — a row rendered on its own, which is what the row
 * tests do — and the row then keeps focus on its own outcome, which is the
 * last-row rule rather than a new one.
 */
export const QueueHandoff = createContext<(() => boolean) | null>(null);

/**
 * The line focus lands on when the table hands the keyboard to a row: the
 * sentence an Admin has to read before deciding, never a control.
 */
export const QUEUE_ANCHOR = "data-queue-anchor";

/**
 * The ref a queue row puts on its announcement.
 *
 * It is what a refusal focuses, and it is also the fallback when the decided row
 * was the last one waiting — there is nowhere onward, and dropping focus to the
 * document would cost exactly the re-orientation this exists to prevent.
 */
export function useQueueRow(result: QueueRowResult) {
  const announcementRef = useRef<HTMLParagraphElement>(null);
  const handoff = useContext(QueueHandoff);

  /**
   * Read from `result` rather than from a derived boolean: a boolean stays `true`
   * across a second outcome, so focus would move once and never again. `result`
   * is a fresh object per dispatch.
   */
  useEffect(() => {
    if (result.data) {
      if (!handoff?.()) announcementRef.current?.focus();
      return;
    }

    if (result.serverError ?? result.validationErrors) announcementRef.current?.focus();
    // `handoff` is deliberately not a dependency: the table rebuilds it on every
    // render, and re-running this effect for a new function with the same result
    // would hand the keyboard on a second time.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  return { announcementRef };
}
