"use client";

/**
 * The profile forms' machine: `_lib/form/use-action-form.ts` with the three
 * profile-shaped pieces supplied.
 *
 * **It was the machine until story 6 needed one too.** The Offer form has three
 * fields, no Skill picker and no consent checkbox, and needed every line of what
 * this file used to hold — so the machine moved one directory over and this
 * became the wrapper that knows about profiles. What was profile-shaped in it is
 * exactly what is passed below: the two summary builders, which are typed over
 * `PublishFieldName`, and the schema that recovers her values from a refusal.
 *
 * Nothing about either surface's call site changed, which is the point of the
 * wrapper: `/publish` and `/my-profile/edit` still ask for `useProfileForm` and
 * still get a machine that knows their fields.
 *
 * **TanStack Form owns field state and client-side validation; it does not own
 * submission** (ADR-0014). That, and every rule the machine holds, is documented
 * where the machine now lives.
 */

import type { ActionFormResult } from "@/app/_lib/form/use-action-form";
import { type ActionFormMachine, useActionForm } from "@/app/_lib/form/use-action-form";
import { type RefusedProfileValues, refusedProfileValues } from "./schema";
import { type Summary, summaryFromIssues, summaryFromValidationErrors } from "./summary";

export { INITIAL_RESULT } from "@/app/_lib/form/use-action-form";
export type { Feedback } from "@/app/_lib/form/use-action-form";

/** What this surface's `useActionState` result carries. Unchanged. */
export type ProfileFormResult = ActionFormResult;

/** The action, already bound by its caller. Unchanged. */
export type ProfileFormAction = (state: never, formData: FormData) => Promise<ProfileFormResult>;

export type ProfileFormMachine = ActionFormMachine<Summary, RefusedProfileValues>;

export interface ProfileFormOptions {
  readonly action: ProfileFormAction;
  readonly initial: ProfileFormResult;
  readonly schema: Parameters<typeof useActionForm>[0]["schema"];
  readonly faultMessage: string;
}

export function useProfileForm({
  action,
  initial,
  schema,
  faultMessage,
}: ProfileFormOptions): ProfileFormMachine {
  return useActionForm<Summary, RefusedProfileValues>({
    action,
    initial,
    schema,
    faultMessage,
    summaryFromIssues,
    summaryFromValidationErrors,
    refusedValuesOf,
  });
}

/**
 * Her values, from whichever refusal carried them — the field refusal and the
 * ceiling both echo the parsed input. Read through the schema rather than
 * trusted, because `input` is typed `unknown` on the wire.
 */
export function refusedValuesOf(result: ProfileFormResult): RefusedProfileValues | undefined {
  const echoed = refusedProfileValues.safeParse(result.serverError?.input);
  return echoed.success ? echoed.data : undefined;
}
