"use client";

/**
 * Her answer to one delivered Offer, at the foot of its open row: accept, in two
 * steps, or decline, in one.
 *
 * **The second step of accepting is a dialog over the page** (`/prototype`,
 * variant A, picked 2026-09-10). This is the one moment on the site that should
 * interrupt: it takes the screen for the one sentence that matters. The brief at
 * `.impeccable/briefs/received-offer.md` records the alternatives it was chosen
 * over.
 *
 * **Equal weight.** The two first-step controls carry the same `outline`
 * variant: a filled Accept is the platform leaning on her, and the voice guide's
 * row for reading an Offer says _no default-highlighted Accept_ in as many words.
 * The row leaves room for story 10's _Reportar_ as a third, wrapping rather than
 * shrinking.
 *
 * **The second step names what crosses and that it cannot be undone, before its
 * button is reached** — the ticket's keyboard criterion. Base UI moves focus
 * into the dialog on open, traps it there and returns it to _Aceptar_ on close;
 * the first control inside is _Volver_, so the safe answer is the one a stray
 * Enter lands on. The committing button says the verb of the act, _Aceptar y dar
 * mis datos_, and carries `name="confirmed" value="true"`, so the action's
 * `confirmed: true` arrives only from the step that said what it means.
 *
 * **Declining is one tap, confirmed afterwards.** It crosses nothing, so a
 * second step would protect nothing; the confirmation is the row's state line,
 * shown on this visit and every later one.
 *
 * **`useActionState` over the real action reference** (`lib/safe-action.ts`),
 * with the Offer id bound rather than mirrored into a hidden field (ADR-0015).
 * Success is a redirect, so the only result that ever lands here is a refusal,
 * rendered as an `alert` beside the controls.
 *
 * **The heading's `id` carries the Offer's**, because the ledger renders one of
 * these per waiting row: a shared `id` would label every row's controls with
 * the first row's heading.
 */

import { Button } from "@repo/design-system/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/design-system/components/dialog";
import { useActionState } from "react";
import {
  ACCEPT,
  ACCEPT_CONFIRM,
  ACCEPT_IRREVERSIBLE,
  acceptConsequence,
  ACCEPTING,
  ANSWER_HEADING,
  CANCEL,
  DECLINE,
  DECLINING,
} from "../_lib/messages";
import { acceptOffer, declineOffer } from "../actions";

type AcceptResult = Awaited<ReturnType<typeof acceptOffer>>;
type DeclineResult = Awaited<ReturnType<typeof declineOffer>>;

const INITIAL_ACCEPT: AcceptResult = {};
const INITIAL_DECLINE: DeclineResult = {};

export interface AnswerControlsProps {
  readonly offerId: string;
  /** His declared name, for the sentence that says who receives her details. */
  readonly hirerName: string | null;
}

export function AnswerControls({ offerId, hirerName }: AnswerControlsProps) {
  const [accepted, acceptAction, accepting] = useActionState(
    acceptOffer.bind(null, offerId),
    INITIAL_ACCEPT,
  );
  const [declined, declineAction, declining] = useActionState(
    declineOffer.bind(null, offerId),
    INITIAL_DECLINE,
  );

  const busy = accepting || declining;
  const refusal = accepted.serverError?.message ?? declined.serverError?.message;
  const headingId = `offer-answer-${offerId}`;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h3 id={headingId} className="text-lg font-medium">
        {ANSWER_HEADING}
      </h3>

      <div className="flex flex-wrap gap-3">
        <Dialog>
          <DialogTrigger render={<Button variant="outline" disabled={busy} />}>
            {ACCEPT}
          </DialogTrigger>
          {/*
            **No corner close button.** The registry's one is announced as
            "Close" — English, on a page whose `lang` is `es-CO` — and _Volver_
            below already does the same thing, in words, as the first control
            focus reaches. Escape still closes it.
          */}
          <DialogContent showCloseButton={false}>
            <DialogHeader>
              <DialogTitle>{ANSWER_HEADING}</DialogTitle>
              <DialogDescription>
                {acceptConsequence(hirerName)} {ACCEPT_IRREVERSIBLE}
              </DialogDescription>
            </DialogHeader>
            <form action={acceptAction}>
              <DialogFooter>
                <DialogClose render={<Button type="button" variant="outline" />}>
                  {CANCEL}
                </DialogClose>
                <Button type="submit" name="confirmed" value="true" disabled={busy}>
                  {accepting ? ACCEPTING : ACCEPT_CONFIRM}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <form action={declineAction}>
          <Button type="submit" variant="outline" disabled={busy}>
            {declining ? DECLINING : DECLINE}
          </Button>
        </form>
      </div>

      {/* The refusal, where she is looking. `alert`: her answer did not land. */}
      {refusal ? (
        <p role="alert" className="text-foreground text-sm font-medium">
          {refusal}
        </p>
      ) : null}
    </section>
  );
}
