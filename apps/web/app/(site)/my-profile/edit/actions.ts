"use server";

/**
 * `/my-profile/edit`'s one action.
 *
 * It is `/publish`'s action with the consent removed and the outcomes changed,
 * and every discipline that one has, this one has for the same reasons:
 *
 * **It authorizes independently.** `accountActionClient` refuses a caller with
 * no session before the boundary parse, because Next compiles this to a
 * directly reachable POST endpoint and the page's own gate does not extend to
 * it.
 *
 * **It rate-limits** on the Account and on the IP, charging before the body
 * runs — so a save the rejector refuses spends one of the ten, which is the
 * case the seventh state exists for.
 *
 * **It parses the whole payload once** — the lenient shape at `.inputSchema`,
 * the strict rules on the first line of the body — and **calls one domain
 * module**. `profiles.update` runs the same rejector, rewrites `searchText`,
 * stamps `updatedAt`, and leaves the slug and `publishedAt` alone.
 *
 * **There is no bound argument.** `/publish` binds the consent versions it
 * displayed; nothing travels with this submit that she does not type, so there
 * is nothing to bind and — as there — nothing hidden either (ADR-0015).
 *
 * **Every refusal comes back as a returned error, with her values**, so the
 * unhydrated path can re-render the form from what this returned rather than
 * from an empty one under a sentence promising nothing was lost. Success is a
 * redirect; nothing renders here.
 */

import { profiles } from "@repo/domain/profiles";
import { redirect } from "next/navigation";
import { PROFILE_UPDATE_REFUSED_CODE } from "@/app/_lib/profile-form/codes";
import { refuseWith, treeFromRefusals } from "@/app/_lib/profile-form/refusals";
import {
  updateProfileFields,
  type UpdateProfileValues,
  updateProfileValuesSchema,
} from "@/app/_lib/profile-form/schema";
import { type FieldErrorTree, treeFromIssues } from "@/app/_lib/profile-form/summary";
import { type AccountContext, accountActionClient } from "@/lib/account";
import { rateLimit } from "@/lib/safe-action";

/** This surface's refusal, named so the browser can tell it from a publish's. */
function refuse(errors: FieldErrorTree, values: UpdateProfileValues): never {
  return refuseWith({
    code: PROFILE_UPDATE_REFUSED_CODE,
    message:
      "The profile edit form was refused on one or more fields; the verdict travels back with it.",
    errors,
    values,
  });
}

export const updateProfile = accountActionClient
  .inputSchema(updateProfileValuesSchema)
  .useValidated(
    rateLimit<UpdateProfileValues, AccountContext>({
      action: "updateProfile",
      principals: [
        { scope: "account", id: (_input, ctx) => ctx.session.accountId },
        { scope: "ip" },
      ],
    }),
  )
  .stateAction(async ({ parsedInput: values, ctx }) => {
    const parsed = updateProfileFields.safeParse(values);
    if (!parsed.success) return refuse(treeFromIssues(parsed.error.issues), values);

    const outcome = await profiles.update(ctx.session.accountId, parsed.data);

    if (!outcome.ok) {
      /**
       * She has nothing to edit, so the form is the wrong page — the same
       * answer `/my-profile` gives, and a route rather than a message for the
       * same reason. This is reachable by a direct POST from a session that
       * never published, which is precisely why the action asks rather than
       * trusting the page that rendered the form.
       */
      if (outcome.reason === "no_profile") redirect("/publish");

      return refuse(treeFromRefusals(outcome.refusals), values);
    }

    /**
     * `redirect` throws a framework interrupt that next-safe-action re-throws
     * rather than routing through `handleServerError` — a navigation, not a
     * swallowed failure. `/my-profile` renders the confirmation, because the
     * proof that the edit took is the page showing what people can see.
     */
    redirect("/my-profile?saved=1");
  });
