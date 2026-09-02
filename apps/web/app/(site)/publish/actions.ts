"use server";

/**
 * `/publish`'s two actions: publishing a profile, and asking for a capability
 * the closed list does not hold.
 *
 * **It authorizes independently** — `accountActionClient` refuses a caller with
 * no session before the boundary parse, because Next compiles this to a
 * directly reachable POST endpoint and the page's own gate does not extend to
 * it. **It rate-limits** on the Account and on the IP (NFR26), charging before
 * the body runs so a refused attempt spends one of the three — the case the
 * seventh state exists for. **It parses the whole payload once**: the shape at
 * `.inputSchema`, the rules on the first line of the body, and **calls one
 * domain module**: `profiles.publish` runs the rejector, mints the slug, and
 * writes profile, Skills, work history and the Worker's Consent row in one
 * transaction.
 *
 * **`.stateAction()`, so NFR4 stays reachable** — see `lib/safe-action.ts`.
 *
 * **Every refusal comes back as a returned error, and it comes back with her
 * values.** The boundary schema is the lenient one and the strict parse runs
 * here, because a refusal through `returnValidationErrors` carries errors and
 * nothing else — and on the unhydrated path the page re-renders from what this
 * returns, so a form that re-rendered empty under _nothing you typed was lost_
 * would be lying (NFR12, the seventh state). The refusal is a `returnActionError`
 * carrying `fieldErrors` and `input`, whichever side refused it: one `warn`
 * line, no Sentry event (CLAUDE.md, "thrown is reported; returned is logged"),
 * and — the reason it is an error rather than data — a postback that actually
 * completes (see `ActionError.fieldErrors`). An Account that already holds a
 * profile is redirected to it — the spec's own `permission denied` cell — and
 * success is a redirect too; nothing renders here.
 */

import { type PublishRefusal, profiles } from "@repo/domain/profiles";
import { skills } from "@repo/domain/skills";
import { AppError, projectClientError } from "@repo/errors/app-error";
import { logRequestError } from "@repo/observability/log-request-error";
import { redirect } from "next/navigation";
import { type AccountContext, accountActionClient } from "@/lib/account";
import { rateLimit, returnActionError } from "@/lib/safe-action";
import {
  CITY_REQUIRED,
  contactDetailRefusal,
  type PublishFieldName,
  PHONE_LOOKS_WRONG,
  SKILL_NO_LONGER_LISTED,
  SKILL_REQUIRED,
  SUMMARY_KEPT,
} from "./_lib/messages";
import {
  consentVersionsArg,
  publishProfileFields,
  type PublishProfileValues,
  publishProfileValuesSchema,
  skillRequestSchema,
  type SkillRequestValues,
} from "./_lib/schema";
import { PUBLISH_REFUSED_CODE, SKILL_REQUEST_REFUSED_CODE } from "./_lib/codes";
import { type FieldErrorTree, treeFromIssues } from "./_lib/summary";

/**
 * Refuse by return, with the tree and her values. Logged at `warn` because a
 * returned error bypasses `handleServerError`, which is where every thrown one
 * is logged — a refusal nothing records is a failure nothing records.
 */
function refuse(errors: FieldErrorTree, values: PublishProfileValues): never {
  const refusal = new AppError({
    code: PUBLISH_REFUSED_CODE,
    status: 422,
    message:
      "The publishing form was refused on one or more fields; the verdict travels back with it.",
    // The sentence the summary already says; the tree carries the rest.
    userMessage: SUMMARY_KEPT,
    // Field names only — identifiers, never what she typed (NFR18).
    context: { fields: Object.keys(errors).filter((key) => key !== "_errors") },
  });
  logRequestError(refusal, { level: "warn" });
  return returnActionError({ ...projectClientError(refusal), fieldErrors: errors, input: values });
}

/**
 * The domain's refusals, as the sentences the surface renders on each field.
 * The mapping is the only place the two vocabularies meet, and it is here rather
 * than in the domain because the sentence is `es-CO` copy under the voice guide
 * and the refusal is an English identifier (ADR-0012).
 */
function treeFromRefusals(refusals: readonly PublishRefusal[]): FieldErrorTree {
  const tree: FieldErrorTree = {};
  // oxlint-disable-next-line no-underscore-dangle -- the tree's own key
  const say = (field: Exclude<PublishFieldName, "workHistory">, message: string) => {
    tree[field] = { _errors: [message] };
  };

  for (const refusal of refusals) {
    switch (refusal.code) {
      case "contact_detail": {
        const message = contactDetailRefusal(refusal.kind, refusal.fragment);
        if (refusal.field === "workHistory") {
          tree.workHistory ??= {};
          // oxlint-disable-next-line no-underscore-dangle
          if (refusal.index === undefined) tree.workHistory._errors = [message];
          // oxlint-disable-next-line no-underscore-dangle
          else tree.workHistory[refusal.index] = { _errors: [message] };
        } else {
          say(refusal.field, message);
        }
        break;
      }
      case "unknown_skill":
        say("skillSlugs", SKILL_NO_LONGER_LISTED);
        break;
      case "no_skill":
        say("skillSlugs", SKILL_REQUIRED);
        break;
      case "phone_unrecognised":
        say("phone", PHONE_LOOKS_WRONG);
        break;
      case "city_unknown":
        say("city", CITY_REQUIRED);
        break;
    }
  }

  return tree;
}

export const publishProfile = accountActionClient
  .bindArgsSchemas([consentVersionsArg])
  .inputSchema(publishProfileValuesSchema)
  /**
   * `useValidated`, so a payload that is not even the right shape costs her
   * nothing. The Account principal comes from `ctx`, which is why `rateLimit`
   * learned to read it; the IP principal needs nothing from anyone.
   */
  .useValidated(
    rateLimit<PublishProfileValues, AccountContext>({
      action: "publishProfile",
      principals: [
        { scope: "account", id: (_input, ctx) => ctx.session.accountId },
        { scope: "ip" },
      ],
    }),
  )
  .stateAction(async ({ parsedInput: values, bindArgsParsedInputs: [consentVersions], ctx }) => {
    const parsed = publishProfileFields.safeParse(values);
    if (!parsed.success) return refuse(treeFromIssues(parsed.error.issues), values);

    const { consent: _consent, ...fields } = parsed.data;
    const outcome = await profiles.publish(ctx.session.accountId, {
      ...fields,
      consentVersions,
    });

    if (!outcome.ok) {
      // She already has one, so the form is the wrong page: the spec's own
      // `permission denied` cell for this surface is a route, not a message.
      if (outcome.reason === "already_has_profile") redirect("/my-profile");

      return refuse(treeFromRefusals(outcome.refusals), values);
    }

    /**
     * `redirect` throws a framework interrupt that next-safe-action re-throws
     * rather than routing through `handleServerError` — a navigation, not a
     * swallowed failure. `/my-profile` renders the confirmation.
     */
    redirect("/my-profile?published=1");
  });

/** What comes back when a request lands: that it did, and nothing else. */
export interface SkillRequested {
  readonly requested: true;
}

/**
 * Ask for a capability the list does not hold, **without leaving the form**.
 *
 * **It navigates nowhere and returns nothing about her draft**, which is the
 * whole requirement: she is mid-publish, everything is typed, and a request that
 * cost her the page would be worse than no request at all. So this action knows
 * only its own field — the publishing form's values never travel with it — and
 * the page it was dispatched from re-renders nothing.
 *
 * **It authorizes and rate-limits exactly as `publishProfile` does**, for the
 * same two reasons: Next compiles it to a directly reachable POST endpoint that
 * the page's gate does not cover, and NFR26 bounds it at five a day per Account
 * and per IP. The ceiling's own sentence is the one the spec singles out, and it
 * is written where every ceiling's copy lives.
 *
 * **The refusal is returned, never thrown.** A phone number typed into a field
 * asking what she can do is an ordinary use of a form; `returnActionError` costs
 * one `warn` line and no Sentry event.
 */
export const requestSkill = accountActionClient
  .inputSchema(skillRequestSchema)
  .useValidated(
    rateLimit<SkillRequestValues, AccountContext>({
      action: "requestSkill",
      principals: [
        { scope: "account", id: (_input, ctx) => ctx.session.accountId },
        { scope: "ip" },
      ],
    }),
  )
  .stateAction<SkillRequested>(async ({ parsedInput: { text }, ctx }) => {
    const outcome = await skills.request(ctx.session.accountId, text);

    if (!outcome.ok) {
      const refusal = new AppError({
        code: SKILL_REQUEST_REFUSED_CODE,
        status: 422,
        message:
          "A Skill request carried a contact detail and was refused before it became a row. " +
          "The fragment travels back to her; nothing was written.",
        userMessage: contactDetailRefusal(outcome.kind, outcome.fragment),
        // The kind is an enum value. The fragment is not on the line: it is part
        // of a phone number or an address, which is `personal` (NFR18).
        context: { kind: outcome.kind },
      });

      logRequestError(refusal, { level: "warn" });
      return returnActionError(projectClientError(refusal));
    }

    /**
     * **A flag, and nothing of hers.** The sentence she reads is the surface's,
     * so there is nothing to send back but the fact that it arrived — and the
     * request's own id is an identifier only an Admin has any use for.
     */
    return { requested: true };
  });
