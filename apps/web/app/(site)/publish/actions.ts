"use server";

/**
 * `/publish`'s one action.
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

import { profiles } from "@repo/domain/profiles";
import { redirect } from "next/navigation";
import { PUBLISH_REFUSED_CODE } from "@/app/_lib/profile-form/codes";
import { refuseWith, treeFromRefusals } from "@/app/_lib/profile-form/refusals";
import {
  consentVersionsArg,
  publishProfileFields,
  type PublishProfileValues,
  publishProfileValuesSchema,
} from "@/app/_lib/profile-form/schema";
import { type FieldErrorTree, treeFromIssues } from "@/app/_lib/profile-form/summary";
import { type AccountContext, accountActionClient } from "@/lib/account";
import { rateLimit } from "@/lib/safe-action";

/** This surface's refusal, named so the browser can tell it from an edit's. */
function refuse(errors: FieldErrorTree, values: PublishProfileValues): never {
  return refuseWith({
    code: PUBLISH_REFUSED_CODE,
    message:
      "The publishing form was refused on one or more fields; the verdict travels back with it.",
    errors,
    values,
  });
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
