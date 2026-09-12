"use server";

/**
 * The ledger's two answers, accepting and declining — posted from an open row
 * at `/offers` and at `/offers/[id]` alike.
 *
 * **Each authorizes independently** — `accountActionClient` refuses a caller with
 * no session before the boundary parse, because Next compiles each to a directly
 * reachable POST endpoint and the page's own gate does not extend to it. **The
 * ownership check is the domain's**, inside the transaction and beneath the row
 * lock, so there is no second copy of it here to drift.
 *
 * **Neither carries a ceiling.** DD7 decided it for accepting — refusing a Worker
 * the acceptance she waited for, to slow a harvester who would first have to be
 * sent the Offer, protects the wrong person. Declining has none registered, and
 * inventing a number here is #30's job rather than this surface's.
 *
 * **`.stateAction()`, so the form stays a real server action reference** — see
 * `lib/safe-action.ts`.
 *
 * **Success is a redirect to `/offers/<id>`** — the ledger with that row open
 * and the result announced inside it — which then shows the new state on this
 * visit and every later one. An Offer answered already — two tabs, a double tap
 * that beat the lock's loser — redirects the same way with its own sentence,
 * because the true answer is in that row. **Anything else is one returned 404**:
 * a missing id, an Offer somebody else received, one not let through, one she
 * Reported. One `warn` line, no Sentry event (C51).
 */

import { type AnswerOfferOutcome, offers } from "@repo/domain/offers";
import { AppError, projectClientError } from "@repo/errors/app-error";
import { logRequestError } from "@repo/observability/log-request-error";
import { redirect } from "next/navigation";
import { accountActionClient } from "@/lib/account";
import { returnActionError } from "@/lib/safe-action";
import { deliverExchange } from "./_lib/deliver-exchange";
import { OFFER_GONE } from "./_lib/messages";
import { acceptInputSchema, answerOfferIdArg, declineInputSchema } from "./_lib/answer-schema";

const OFFER_NOT_ANSWERABLE_CODE = "offer_not_answerable";

/** Which action an answer came through, for the one log line a refusal writes. */
const ACTION_FOR = { accepted: "acceptOffer", declined: "declineOffer" } as const;

/**
 * Redirect to the Offer, or refuse. `redirect` throws a framework interrupt that
 * next-safe-action re-throws rather than reporting, so this returns only on the
 * refusal, and that one is returned rather than thrown.
 *
 * **An Offer that expired while the page was open is not "already answered"** —
 * she never answered it — so it lands on the page with no sentence of its own,
 * and the state line there says it lapsed.
 */
function redirectOrRefuse(
  outcome: AnswerOfferOutcome,
  offerId: string,
  answer: keyof typeof ACTION_FOR,
): never {
  const action = ACTION_FOR[answer];

  if (outcome.ok) redirect(`/offers/${offerId}?answered=${answer}`);
  if (outcome.reason === "already_answered") {
    redirect(
      outcome.state === "expired" ? `/offers/${offerId}` : `/offers/${offerId}?answered=already`,
    );
  }

  const refusal = new AppError({
    code: OFFER_NOT_ANSWERABLE_CODE,
    status: 404,
    message:
      `${action} named an Offer the caller may not answer: an id no row carries, one ` +
      "addressed to another profile, one not yet delivered, or one she Reported. The " +
      "domain gives one answer for all four, so this does too.",
    userMessage: OFFER_GONE,
    // The action name only. The Offer id is not hers to have probed for, and
    // naming it would put a caller-chosen value on a line (NFR18).
    context: { action },
  });

  logRequestError(refusal, { level: "warn" });
  return returnActionError(projectClientError(refusal));
}

/**
 * **The exchange commits inside `offers.accept`, and the two copies go out here,
 * after it** — before the redirect, so the row she lands on already says
 * whether her copy was sent. `deliverExchange` never throws: a failed copy is
 * recorded against its side and the accept stands.
 */
export const acceptOffer = accountActionClient
  .bindArgsSchemas([answerOfferIdArg])
  .inputSchema(acceptInputSchema)
  .stateAction(async ({ bindArgsParsedInputs: [offerId], ctx }) => {
    const outcome = await offers.accept(ctx.session.accountId, offerId);

    if (outcome.ok) await deliverExchange(outcome.exchange);

    return redirectOrRefuse(outcome, offerId, "accepted");
  });

export const declineOffer = accountActionClient
  .bindArgsSchemas([answerOfferIdArg])
  .inputSchema(declineInputSchema)
  .stateAction(async ({ bindArgsParsedInputs: [offerId], ctx }) => {
    const outcome = await offers.decline(ctx.session.accountId, offerId);

    return redirectOrRefuse(outcome, offerId, "declined");
  });
