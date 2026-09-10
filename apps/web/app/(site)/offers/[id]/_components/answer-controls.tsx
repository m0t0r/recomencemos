"use client";

/**
 * Her answer to one delivered Offer: accept, in two steps, or decline.
 *
 * **Equal weight.** The two first-step controls carry the same `outline`
 * variant: a filled Accept is the platform leaning on her, and the voice guide's
 * row for reading an Offer says _no default-highlighted Accept_ in as many words.
 *
 * **The second step of accepting names what crosses and that it cannot be
 * undone, before its button is reached** — the ticket's keyboard criterion. Its
 * button says the verb of the act, _Aceptar y dar mis datos_, and carries
 * `name="confirmed" value="true"`, so the action's `confirmed: true` arrives only
 * from the step that said what it means.
 *
 * **`useActionState` over the real action reference** (`lib/safe-action.ts`),
 * with the Offer id bound rather than mirrored into a hidden field (ADR-0015).
 * Success is a redirect, so the only result that ever lands here is a refusal,
 * and it is rendered as an `alert` beside the controls.
 *
 * PROTOTYPE — the three compositions below are the brief's `[open]` items 1 and
 * 2, pending the pick: a dialog over the page, the page itself, or a bar fixed
 * to the foot of a phone screen. The losers go with the switcher.
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
import { useActionState, useEffect, useRef, useState } from "react";
import {
  ACCEPT,
  ACCEPT_CONFIRM,
  ACCEPT_IRREVERSIBLE,
  acceptConsequence,
  ACCEPTING,
  ANSWER_HEADING,
  CANCEL,
  DECLINE,
  DECLINE_CONFIRM,
  DECLINE_CONSEQUENCE,
  DECLINING,
} from "../../_lib/messages";
import { acceptOffer, declineOffer } from "../actions";

type AcceptResult = Awaited<ReturnType<typeof acceptOffer>>;
type DeclineResult = Awaited<ReturnType<typeof declineOffer>>;

const INITIAL_ACCEPT: AcceptResult = {};
const INITIAL_DECLINE: DeclineResult = {};

export interface AnswerControlsProps {
  readonly offerId: string;
  /** His declared name, for the sentence that says who receives her details. */
  readonly hirerName: string | null;
  /** PROTOTYPE — throwaway, with the variants. */
  readonly variant: string;
}

/** The two actions, bound to this Offer, with their pending flags and one refusal. */
function useAnswer(offerId: string) {
  const [accepted, acceptAction, accepting] = useActionState(
    acceptOffer.bind(null, offerId),
    INITIAL_ACCEPT,
  );
  const [declined, declineAction, declining] = useActionState(
    declineOffer.bind(null, offerId),
    INITIAL_DECLINE,
  );

  const refusal = accepted.serverError?.message ?? declined.serverError?.message;

  return {
    acceptAction,
    accepting,
    declineAction,
    declining,
    busy: accepting || declining,
    refusal,
  };
}

/** The refusal, where she is looking. `alert`: it interrupts, because her answer did not land. */
function Refusal({ message }: { readonly message: string | undefined }) {
  if (!message) return null;

  return (
    <p role="alert" className="text-foreground text-sm font-medium">
      {message}
    </p>
  );
}

/** A — the second step of accepting is a dialog; declining is one tap, confirmed after. */
function DialogAnswer({ offerId, hirerName }: Omit<AnswerControlsProps, "variant">) {
  const answer = useAnswer(offerId);

  return (
    <section
      aria-labelledby="offer-answer"
      className="border-border flex flex-col gap-3 border-t pt-6"
    >
      <h2 id="offer-answer" className="text-lg font-medium">
        {ANSWER_HEADING}
      </h2>
      <div className="flex flex-wrap gap-3">
        <Dialog>
          <DialogTrigger render={<Button variant="outline" disabled={answer.busy} />}>
            {ACCEPT}
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{ANSWER_HEADING}</DialogTitle>
              <DialogDescription>
                {acceptConsequence(hirerName)} {ACCEPT_IRREVERSIBLE}
              </DialogDescription>
            </DialogHeader>
            <form action={answer.acceptAction}>
              <DialogFooter>
                <DialogClose render={<Button type="button" variant="outline" />}>
                  {CANCEL}
                </DialogClose>
                <Button type="submit" name="confirmed" value="true" disabled={answer.busy}>
                  {answer.accepting ? ACCEPTING : ACCEPT_CONFIRM}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <form action={answer.declineAction}>
          <Button type="submit" variant="outline" disabled={answer.busy}>
            {answer.declining ? DECLINING : DECLINE}
          </Button>
        </form>
      </div>
      <Refusal message={answer.refusal} />
    </section>
  );
}

type Step = "accept" | "decline" | undefined;

/**
 * B and C — both answers take two steps, and the second replaces the first in
 * place. Without a dialog to manage focus, this does it: opening a second step
 * moves focus to it, and going back returns focus to the control that opened it.
 *
 * `bar` is C: fixed to the foot of a phone screen, where a thumb already is, and
 * back in the page from `sm` up, where a bar pinned to the bottom of a window is
 * a long way from what it is about.
 */
function TwoStepAnswer({
  offerId,
  hirerName,
  bar,
}: Omit<AnswerControlsProps, "variant"> & { readonly bar: boolean }) {
  const answer = useAnswer(offerId);
  const [step, setStep] = useState<Step>(undefined);
  const stepRef = useRef<HTMLElement>(null);
  const acceptRef = useRef<HTMLButtonElement>(null);
  const declineRef = useRef<HTMLButtonElement>(null);
  const cameFrom = useRef<Step>(undefined);

  useEffect(() => {
    if (step) {
      stepRef.current?.focus();
      return;
    }
    if (cameFrom.current === "accept") acceptRef.current?.focus();
    if (cameFrom.current === "decline") declineRef.current?.focus();
  }, [step]);

  function open(next: "accept" | "decline") {
    cameFrom.current = next;
    setStep(next);
  }

  const accepting = step === "accept";
  const confirmLabel = accepting
    ? answer.accepting
      ? ACCEPTING
      : ACCEPT_CONFIRM
    : answer.declining
      ? DECLINING
      : DECLINE_CONFIRM;

  const placement = bar
    ? "bg-background fixed inset-x-0 bottom-0 z-40 px-4 pt-4 pb-6 shadow-[0_-4px_12px_rgb(0_0_0/0.06)] sm:static sm:z-auto sm:px-0 sm:pt-6 sm:pb-0 sm:shadow-none"
    : "pt-6";

  return (
    <>
      {/* Room for C's bar, so the last line of the page is never under it. */}
      {bar ? <div aria-hidden="true" className="h-32 sm:hidden" /> : null}
      <section
        aria-labelledby="offer-answer"
        className={`border-border flex flex-col gap-3 border-t ${placement}`}
      >
        <h2
          id="offer-answer"
          className={bar ? "text-sm font-medium sm:text-lg" : "text-lg font-medium"}
        >
          {ANSWER_HEADING}
        </h2>

        {step ? (
          /*
            The second step. `tabIndex={-1}` so it can take focus when it opens,
            and named by the answer heading so a screen reader announces where
            she has landed before reading what it says.
          */
          <section
            ref={stepRef}
            tabIndex={-1}
            aria-labelledby="offer-answer"
            className="flex flex-col gap-3 focus:outline-none"
          >
            {accepting ? (
              <>
                <p className="text-foreground">{acceptConsequence(hirerName)}</p>
                <p className="text-foreground font-medium">{ACCEPT_IRREVERSIBLE}</p>
              </>
            ) : (
              <p className="text-foreground">{DECLINE_CONSEQUENCE}</p>
            )}
            <form
              action={accepting ? answer.acceptAction : answer.declineAction}
              className="flex flex-wrap gap-3"
            >
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(undefined)}
                disabled={answer.busy}
              >
                {CANCEL}
              </Button>
              <Button type="submit" name="confirmed" value="true" disabled={answer.busy}>
                {confirmLabel}
              </Button>
            </form>
          </section>
        ) : (
          <div className="flex flex-wrap gap-3">
            <Button ref={acceptRef} variant="outline" onClick={() => open("accept")}>
              {ACCEPT}
            </Button>
            <Button ref={declineRef} variant="outline" onClick={() => open("decline")}>
              {DECLINE}
            </Button>
          </div>
        )}

        <Refusal message={answer.refusal} />
      </section>
    </>
  );
}

export function AnswerControls({ offerId, hirerName, variant }: AnswerControlsProps) {
  if (variant === "b") return <TwoStepAnswer offerId={offerId} hirerName={hirerName} bar={false} />;
  if (variant === "c") return <TwoStepAnswer offerId={offerId} hirerName={hirerName} bar />;

  return <DialogAnswer offerId={offerId} hirerName={hirerName} />;
}
