"use server";

/**
 * `/publish`'s one action.
 *
 * **It authorizes independently** — `accountActionClient` refuses a caller with
 * no session before the boundary parse, because Next compiles this to a
 * directly reachable POST endpoint and the page's own gate does not extend to
 * it. **It rate-limits** on the Account and on the IP (NFR26), charging before
 * the body runs so a refused attempt spends one of the three — the case the
 * seventh state exists for. **It parses the whole payload once**, at
 * `.inputSchema`, and **calls one domain module**: `profiles.publish` runs the
 * rejector, mints the slug, and writes profile, Skills, work history and the
 * Worker's Consent row in one transaction.
 *
 * **`.stateAction()`, so NFR4 stays reachable** — see `lib/safe-action.ts`.
 *
 * **Every refusal comes back as a value.** The domain's refusals become
 * `validationErrors` through `returnValidationErrors`, so the rejector's
 * sentence lands on the field it names exactly as a schema refusal would, and
 * the surface has one shape to render. An Account that already holds a profile
 * is redirected to it — the spec's own `permission denied` cell — rather than
 * told anything. Success is a redirect too; nothing renders here.
 */

import { type PublishRefusal, profiles } from "@repo/domain/profiles";
import { returnValidationErrors } from "next-safe-action";
import { redirect } from "next/navigation";
import { type AccountContext, accountActionClient } from "@/lib/account";
import { rateLimit } from "@/lib/safe-action";
import {
  CITY_REQUIRED,
  contactDetailRefusal,
  PHONE_LOOKS_WRONG,
  SKILL_NO_LONGER_LISTED,
  SKILL_REQUIRED,
} from "./_lib/messages";
import { consentVersionsArg, type PublishProfileInput, publishProfileSchema } from "./_lib/schema";

/** The formatted shape next-safe-action renders `validationErrors` in. */
type Node = { _errors?: string[] };
type ValidationPayload = Node & {
  headline?: Node;
  about?: Node;
  phone?: Node;
  city?: Node;
  skillSlugs?: Node;
  workHistory?: Node & Record<number, Node>;
};

/**
 * The domain's refusals, as the sentences the surface renders on each field.
 * The mapping is the only place the two vocabularies meet, and it is here rather
 * than in the domain because the sentence is `es-CO` copy under the voice guide
 * and the refusal is an English identifier (ADR-0012).
 */
function toValidationErrors(refusals: readonly PublishRefusal[]): ValidationPayload {
  const payload: ValidationPayload = {};

  for (const refusal of refusals) {
    switch (refusal.code) {
      case "contact_detail": {
        const message = contactDetailRefusal(refusal.kind, refusal.fragment);
        if (refusal.field === "workHistory" && refusal.index !== undefined) {
          payload.workHistory ??= {};
          payload.workHistory[refusal.index] = { _errors: [message] };
        } else {
          payload[refusal.field] = { _errors: [message] };
        }
        break;
      }
      case "unknown_skill":
        payload.skillSlugs = { _errors: [SKILL_NO_LONGER_LISTED] };
        break;
      case "no_skill":
        payload.skillSlugs = { _errors: [SKILL_REQUIRED] };
        break;
      case "phone_unrecognised":
        payload.phone = { _errors: [PHONE_LOOKS_WRONG] };
        break;
      case "city_unknown":
        payload.city = { _errors: [CITY_REQUIRED] };
        break;
    }
  }

  return payload;
}

export const publishProfile = accountActionClient
  .bindArgsSchemas([consentVersionsArg])
  .inputSchema(publishProfileSchema)
  /**
   * `useValidated`, so a submission the schema refuses costs her nothing. The
   * Account principal comes from `ctx`, which is why `rateLimit` learned to read
   * it; the IP principal needs nothing from anyone.
   */
  .useValidated(
    rateLimit<PublishProfileInput, AccountContext>({
      action: "publishProfile",
      principals: [
        { scope: "account", id: (_input, ctx) => ctx.session.accountId },
        { scope: "ip" },
      ],
    }),
  )
  .stateAction(async ({ parsedInput, bindArgsParsedInputs: [consentVersions], ctx }) => {
    const { consent: _consent, ...fields } = parsedInput;

    const outcome = await profiles.publish(ctx.session.accountId, {
      ...fields,
      consentVersions,
    });

    if (!outcome.ok) {
      // She already has one, so the form is the wrong page: the spec's own
      // `permission denied` cell for this surface is a route, not a message.
      if (outcome.reason === "already_has_profile") redirect("/my-profile");

      returnValidationErrors(publishProfileSchema, toValidationErrors(outcome.refusals));
    }

    /**
     * `redirect` throws a framework interrupt that next-safe-action re-throws
     * rather than routing through `handleServerError` — a navigation, not a
     * swallowed failure. `/my-profile` renders the confirmation.
     */
    redirect("/my-profile?published=1");
  });
