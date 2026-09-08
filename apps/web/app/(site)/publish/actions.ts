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

import { photos } from "@repo/domain/photos";
import { profiles } from "@repo/domain/profiles";
import { skills } from "@repo/domain/skills";
import { AppError, projectClientError } from "@repo/errors/app-error";
import { logRequestError } from "@repo/observability/log-request-error";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { PUBLISH_REFUSED_CODE, SKILL_REQUEST_REFUSED_CODE } from "@/app/_lib/profile-form/codes";
import { contactDetailRefusal, PHOTO_UPLOAD_UNAVAILABLE } from "@/app/_lib/profile-form/messages";
import { refuseWith, treeFromRefusals } from "@/app/_lib/profile-form/refusals";
import {
  consentVersionsArg,
  photoKeyArg,
  type PhotoUploadValues,
  photoUploadSchema,
  publishProfileFields,
  type PublishProfileValues,
  publishProfileValuesSchema,
  skillRequestSchema,
  type SkillRequestValues,
} from "@/app/_lib/profile-form/schema";
import { type FieldErrorTree, treeFromIssues } from "@/app/_lib/profile-form/summary";
import { type AccountContext, accountActionClient } from "@/lib/account";
import { rateLimit, returnActionError } from "@/lib/safe-action";

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
  .bindArgsSchemas([consentVersionsArg, photoKeyArg])
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
  .stateAction(
    async ({ parsedInput: values, bindArgsParsedInputs: [consentVersions, photoKey], ctx }) => {
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
       * **The photo attaches after the profile exists, and never before it.**
       * `attachPhoto` sets a state on a row, so there has to be a row — which is
       * also why this cannot travel inside `publishProfile`'s transaction as
       * another field.
       *
       * **Its failure is swallowed on purpose, and the copy has been promising
       * that all along.** Publishing does not wait for the photo (NFR1 against
       * NFR6), the help line under the field says so, and the whole ticket is
       * arranged so that she does not read the two facts as one. A profile that
       * refused to publish because a picture would not attach would be exactly the
       * confusion the voice guide bans by name. The domain logs its own `warn`
       * line; the quarantined object is unreachable and the bucket collects it.
       *
       * A key that is absent — she picked nothing, or the upload lost the race
       * with her submit — is the ordinary case and does nothing at all.
       */
      if (photoKey) await photos.attach(ctx.session.accountId, photoKey);

      /**
       * **The shell has to be told, and this is the observation rather than a
       * precaution.** Driven through the real form against `next dev`: she
       * publishes, lands on `/my-profile` reading _Tu perfil ya está publicado_,
       * and the session menu 56 px above that sentence still offers the row that
       * sends her to `/publish` — on that page, and on every page she reaches by
       * clicking afterwards, for the rest of the document's life. A full page load
       * was the only thing that corrected it.
       *
       * The header is rendered by `(site)`'s layout, and the App Router does not
       * re-render a layout on a client navigation inside its own subtree — the
       * redirect below is one. So the two halves of one screen disagreed: the Wall
       * list re-rendered because it is a page segment, and the menu did not because
       * it is in the layout. Both were read out of the same snapshot.
       *
       * The rule this is one instance of — why `refresh()` rather than any revalidate
       * API, and why _Salir_ needs none of it — is in
       * `app/_components/app-header/app-header.tsx`, beside the reads it protects.
       * What is written here is what was measured here.
       */

      refresh();

      /**
       * `redirect` throws a framework interrupt that next-safe-action re-throws
       * rather than routing through `handleServerError` — a navigation, not a
       * swallowed failure. `/my-profile` renders the confirmation.
       */
      redirect("/my-profile?published=1");
    },
  );

/** Where the browser PUTs one photo, and what the row will call it. */
export interface PhotoUploadTicket {
  readonly uploadUrl: string;
  readonly photoKey: string;
}

/**
 * Sign one presigned PUT into the quarantine prefix — DD6 step 2.
 *
 * **`.action()` rather than `.stateAction()`, and this is the one place in the
 * product where that is right.** ADR-0015's rule exists to keep NFR4 reachable:
 * a form has to post and re-render without JavaScript, so it needs
 * `useActionState`. This is not a form post — it is a call from an event
 * handler, on **the one field NFR4 explicitly exempts**, and there is no
 * unhydrated path for it to have. What ADR-0015 actually bans is next-safe-
 * action's `useAction`/`useStateAction` hooks; awaiting the action directly is
 * neither.
 *
 * **It authorizes and rate-limits exactly as `publishProfile` does**, for the
 * same two reasons: Next compiles this to a directly reachable POST endpoint
 * that the page's gate does not cover, and NFR26 bounds it at ten a day per
 * Account and per IP.
 *
 * **A signed URL that is never used still spends one of the ten.** The charge is
 * for the capability rather than for the object — there is no way to learn
 * whether a PUT happened, so a ceiling counting completed uploads only would be
 * defeated by not completing them.
 *
 * **The refusal is returned, never thrown.** A ceiling and a store that is not
 * configured are both ordinary answers; each costs one `warn` line and no
 * Sentry event, and the sentence she reads already says the profile is
 * unaffected.
 */
export const createPhotoUpload = accountActionClient
  .inputSchema(photoUploadSchema)
  .useValidated(
    rateLimit<PhotoUploadValues, AccountContext>({
      action: "createPhotoUpload",
      principals: [
        { scope: "account", id: (_input, ctx) => ctx.session.accountId },
        { scope: "ip" },
      ],
    }),
  )
  .action<PhotoUploadTicket>(async ({ parsedInput, ctx }) => {
    try {
      const ticket = await photos.createUpload(ctx.session.accountId, parsedInput);

      // The URL is a write capability with a five-minute life. It crosses to her
      // browser and goes nowhere else — never a log line, never a row.
      return { uploadUrl: ticket.uploadUrl, photoKey: ticket.photoKey };
    } catch (cause) {
      const refusal =
        cause instanceof AppError
          ? cause
          : new AppError({
              code: "photo_upload_not_signed",
              status: 502,
              message:
                "The photo store could not be asked for a presigned upload URL. Nothing was " +
                "written and her profile is unaffected — publishing does not wait for a photo.",
              userMessage: PHOTO_UPLOAD_UNAVAILABLE,
              context: {},
              cause,
            });

      logRequestError(refusal, { level: "warn" });
      return returnActionError(projectClientError(refusal));
    }
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
