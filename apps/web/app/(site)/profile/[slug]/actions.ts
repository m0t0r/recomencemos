"use server";

/**
 * `/profile/[slug]`'s one action: sending an Offer.
 *
 * **It authorizes independently** — `accountActionClient` refuses a caller with
 * no session before the boundary parse, because Next compiles this to a directly
 * reachable POST endpoint and the page's own gate does not extend to it. **It
 * rate-limits** on the Account and on the IP (NFR26), charging before the body
 * runs, so a submission the rejector refuses spends one of the ten — the case the
 * seventh state exists for. **It parses the whole payload once** and **calls one
 * domain module**: `offers.send` takes the row lock, re-reads his sending state
 * and the Block edge beneath it, runs the rejector, and writes the Offer, his
 * asserted identity and his *autorización* in one transaction.
 *
 * **`.stateAction()`, so NFR4 stays reachable** — see `lib/safe-action.ts`.
 *
 * **The slug is a bound argument, not a hidden input** (ADR-0015). It travels
 * with the submit and nobody types it, so React encodes it into the action
 * reference and this validates it on arrival. As a hidden field it would be the
 * one an attacker edits to address the Offer to somebody else — and it would have
 * to be validated here anyway, so the field would buy nothing and cost a
 * mechanism.
 *
 * **Every refusal comes back as a returned error, and it comes back with his
 * values.** One `warn` line, no Sentry event (CLAUDE.md, "thrown is reported;
 * returned is logged") — and, the reason it is an error rather than data, a
 * postback that actually completes on the unhydrated path (see
 * `ActionError.fieldErrors`). Success is a redirect; nothing renders here.
 */

import { consent } from "@repo/domain/consent";
import { type HirerIdentity, offers, type OfferTerms } from "@repo/domain/offers";
import { AppError, projectClientError } from "@repo/errors/app-error";
import { logRequestError } from "@repo/observability/log-request-error";
import { redirect } from "next/navigation";
import type { z } from "zod";
import { type AccountContext, accountActionClient } from "@/lib/account";
import { rateLimit, returnActionError } from "@/lib/safe-action";
import { OFFER_REFUSED_CODE, OFFER_UNAVAILABLE_CODE } from "./_lib/offer-codes";
import {
  OFFER_BLOCKED,
  OFFER_OWN_PROFILE,
  OFFER_PROFILE_GONE,
  OFFER_SENDING_BANNED,
  OFFER_SENDING_FROZEN,
} from "./_lib/offer-messages";
import { refuseOfferWith, treeFromOfferRefusals } from "./_lib/offer-refusals";
import {
  firstOfferFields,
  offerConsentVersionsArg,
  offerFields,
  offerSlugArg,
  type OfferValues,
  offerValuesSchema,
} from "./_lib/offer-schema";
import { offerSummaryFromIssues } from "./_lib/offer-summary";
import type { OfferErrorTree } from "./_lib/offer-refusals";

/**
 * A refusal that is about him rather than about a field — Blocked, frozen,
 * banned, a profile that went away, his own profile.
 *
 * **Returned with no field tree**, which is what puts it in the feedback region
 * above the form rather than beside an input: no field is wrong, and pointing at
 * one would tell him to change something that is not the problem.
 *
 * The sentence is the whole of what he learns. `context` carries the reason as
 * an enum value and nothing else — never the slug, which names her.
 */
function refuseUnavailable(reason: string, userMessage: string, message: string): never {
  const refusal = new AppError({
    code: OFFER_UNAVAILABLE_CODE,
    status: 403,
    message,
    userMessage,
    context: { reason },
  });

  logRequestError(refusal, { level: "warn" });
  return returnActionError(projectClientError(refusal));
}

/**
 * The strict parse, in the two shapes an Offer can arrive in.
 *
 * **Which one runs depends on a row rather than on the page.** The identity
 * fields are required on his first Offer, and "is this his first" is a fact
 * about his Consent row. The page renders them from the same fact, but the page
 * is not what is trusted: this reads it again, and `sendOffer` reads it a third
 * time inside its transaction, where it is the one that counts.
 *
 * **The two branches are written out rather than selected into one `safeParse`**,
 * and that is what keeps this free of a cast: narrowing a union of two parse
 * results by `"hirerName" in …` gives the compiler an intersection whose added
 * key reads as `unknown`, which is exactly where a field going missing would
 * stop being caught. Destructuring the wide branch splits the terms from the
 * identity with both halves typed.
 */
function parseOffer(
  values: OfferValues,
  identified: boolean,
):
  | { readonly ok: true; readonly terms: OfferTerms; readonly identity?: HirerIdentity }
  | { readonly ok: false; readonly issues: readonly z.core.$ZodIssue[] } {
  if (identified) {
    const parsed = offerFields.safeParse(values);

    return parsed.success
      ? { ok: true, terms: parsed.data }
      : { ok: false, issues: parsed.error.issues };
  }

  const parsed = firstOfferFields.safeParse(values);
  if (!parsed.success) return { ok: false, issues: parsed.error.issues };

  const { hirerName, hirerPhone, ...terms } = parsed.data;

  return { ok: true, terms, identity: { hirerName, hirerPhone } };
}

/** This surface's field refusal. */
function refuse(errors: OfferErrorTree, values: OfferValues): never {
  return refuseOfferWith({
    code: OFFER_REFUSED_CODE,
    message: "The Offer form was refused on one or more fields; the verdict travels back with it.",
    errors,
    values,
  });
}

export const sendOffer = accountActionClient
  .bindArgsSchemas([offerSlugArg, offerConsentVersionsArg])
  .inputSchema(offerValuesSchema)
  /**
   * `useValidated`, so a payload that is not even the right shape costs him
   * nothing. The Account principal comes from `ctx`; the IP principal needs
   * nothing from anyone.
   */
  .useValidated(
    rateLimit<OfferValues, AccountContext>({
      action: "sendOffer",
      principals: [
        { scope: "account", id: (_input, ctx) => ctx.session.accountId },
        { scope: "ip" },
      ],
    }),
  )
  .stateAction(
    async ({ parsedInput: values, bindArgsParsedInputs: [profileSlug, consentVersions], ctx }) => {
      /**
       * **The strict parse runs here rather than at `.inputSchema`**, because a
       * refusal through `returnValidationErrors` carries errors and nothing else
       * — and on the unhydrated path the page re-renders from what this returns.
       * A form that re-rendered empty under *nada de lo que escribiste se perdió*
       * would be lying.
       *
       * **Which parse depends on a row, not on the page.** The identity fields
       * are required on his first Offer, and "is this his first" is a fact about
       * his Consent row. The page renders them from the same fact, but the page
       * is not what is trusted: this reads it again, and the domain reads it a
       * third time inside the transaction, where it is the one that counts.
       */
      const identified = await consent.hasConsented(ctx.session.accountId, "hirer");
      const parsed = parseOffer(values, identified);

      if (!parsed.ok) {
        const summary = offerSummaryFromIssues(parsed.issues);
        const errors: OfferErrorTree = {};
        // oxlint-disable-next-line no-underscore-dangle -- the tree's own key
        for (const item of summary?.items ?? []) errors[item.field] = { _errors: [item.message] };

        return refuse(errors, values);
      }

      const outcome = await offers.send(ctx.session.accountId, {
        ...parsed.terms,
        identity: parsed.identity,
        profileSlug,
        consentVersions,
      });

      if (!outcome.ok) {
        switch (outcome.reason) {
          case "refused":
            return refuse(treeFromOfferRefusals(outcome.refusals), values);
          case "blocked":
            return refuseUnavailable(
              "blocked",
              OFFER_BLOCKED,
              "The addressee has Blocked this sender, so the Offer was not written. A Block " +
                "reaches the send and nothing else: her card stays public and his reading of " +
                "her profile stays open.",
            );
          case "may_not_send":
            return refuseUnavailable(
              outcome.state,
              outcome.state === "banned" ? OFFER_SENDING_BANNED : OFFER_SENDING_FROZEN,
              `The sender's Account is ${outcome.state}, read from the row under a lock rather ` +
                "than from the session, so a cookie minted before the freeze cannot outlive it.",
            );
          case "profile_not_found":
            return refuseUnavailable(
              "profile_not_found",
              OFFER_PROFILE_GONE,
              "The slug names no published profile. One answer covers a slug naming nobody and " +
                "a profile taken down between the page load and the submit.",
            );
          case "own_profile":
            return refuseUnavailable(
              "own_profile",
              OFFER_OWN_PROFILE,
              "An Account tried to send an Offer to its own profile, which would inflate the " +
                "delivered-Offer count the browsable list orders by.",
            );
        }
      }

      /**
       * `redirect` throws a framework interrupt that next-safe-action re-throws
       * rather than routing through `handleServerError` — a navigation, not a
       * swallowed failure. `/sent-offers` renders the confirmation, which is
       * also the page that answers the question the confirmation raises.
       */
      redirect("/sent-offers?sent=1");
    },
  );
