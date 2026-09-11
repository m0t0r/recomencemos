"use server";

/**
 * `/my-profile`'s two actions: her Pause switch, one per direction (story 25).
 *
 * **Two endpoints rather than one that toggles.** A toggle decides its direction
 * from the row at the moment it lands, so a double tap — or a form left open in
 * a second tab — would flip her back to where she started while each tap looked
 * like it took. A pause that says "pause" and a resume that says "resume" are
 * both idempotent in the domain, so a repeat of either is a no-op rather than an
 * undo. The switch renders whichever one names the move she is making.
 *
 * **Each authorizes independently.** `accountActionClient` refuses a caller with
 * no session before the boundary parse, because Next compiles each to a directly
 * reachable POST endpoint and the page's own gate does not extend to it. Which
 * profile moves is the session's, never a value in the body — there is no field
 * and no bound argument, so there is nothing for a caller to name.
 *
 * **Both charge one ceiling**, `profilePause`, ten a day per Account whichever
 * way she flips it. The charge comes before the body, so a tap refused by the
 * ceiling writes nothing and the page renders the count and the wait.
 *
 * **Success is a redirect back to the page, carrying which way it went**, so the
 * page can announce the new state in its focused status region — the same
 * arrival pattern publishing and saving use. Without JavaScript the post is a
 * document navigation and the redirect is the whole of it (NFR4). No `refresh()`:
 * nothing in the header reads her Pause.
 *
 * **No `AdminAction`** — the domain writes none, because this is her act on her
 * own row.
 */

import { photos } from "@repo/domain/photos";
import { profiles } from "@repo/domain/profiles";
import { projectClientError } from "@repo/errors/app-error";
import { logRequestError } from "@repo/observability/log-request-error";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { photoKeyArg } from "@/app/_lib/profile-form/schema";
import { type AccountContext, accountActionClient } from "@/lib/account";
import { rateLimit, returnActionError } from "@/lib/safe-action";

/** What a photo that landed answers with: it is waiting on a person now. */
export interface PhotoChanged {
  readonly photoState: "pending";
}

/**
 * **Her new photo, attached the moment its bytes are in the store** (#275).
 *
 * The owner's answer on that ticket is that her photo on this page is the
 * control that changes it, so there is no form to submit and no bound argument
 * to carry — the key arrives from the upload that just finished, in the call
 * that follows it. `/publish` attaches the same way, only later, inside its own
 * action once the profile exists.
 *
 * **`.action()` rather than `.stateAction()`**, for `createPhotoUpload`'s own
 * reason: this is a call from an event handler on the one control NFR4 exempts,
 * so there is no unhydrated path for it to have.
 *
 * **The key is caller-controlled by the time it comes back**, and the domain is
 * what makes that safe: `attachPhoto` consumes the `photo_upload` row minted for
 * *this* Account and this key, so a key is good for one attach, by one person.
 * No ceiling of its own is needed — each attach spends a key `createPhotoUpload`
 * already charged ten a day for.
 *
 * **A refusal is returned, never thrown**: one `warn` line and no Sentry event,
 * and the sentence she reads is the domain's own.
 */
export const changePhoto = accountActionClient
  .inputSchema(z.object({ photoKey: photoKeyArg.unwrap() }))
  .action<PhotoChanged>(async ({ parsedInput, ctx }) => {
    const outcome = await photos.attach(ctx.session.accountId, parsedInput.photoKey);

    if (!outcome.ok) {
      logRequestError(outcome.error, { level: "warn" });
      return returnActionError(projectClientError(outcome.error));
    }

    // Her card below the control reads the photo from the page's own query, so
    // the page's data is what has to be re-read — not the shell above it.
    revalidatePath("/my-profile");

    return { photoState: "pending" };
  });

/**
 * The switch carries nothing: one tap, no field. Whatever a post sends is
 * discarded before parsing, the shape `declineOffer` takes for the same reason.
 */
const switchInputSchema = z.preprocess(() => ({}), z.object({}));

type SwitchInput = z.infer<typeof switchInputSchema>;

const chargeTheSwitch = rateLimit<SwitchInput, AccountContext>({
  action: "profilePause",
  principals: [{ scope: "account", id: (_input, ctx) => ctx.session.accountId }],
});

export const pauseProfile = accountActionClient
  .inputSchema(switchInputSchema)
  .useValidated(chargeTheSwitch)
  .stateAction(async ({ ctx }) => {
    const outcome = await profiles.pause(ctx.session.accountId, new Date());

    // She has nothing to pause: `/my-profile` sends the same session to
    // `/publish`, and this answers a direct post the same way.
    if (!outcome.ok) redirect("/publish");

    redirect("/my-profile?paused=1");
  });

export const resumeProfile = accountActionClient
  .inputSchema(switchInputSchema)
  .useValidated(chargeTheSwitch)
  .stateAction(async ({ ctx }) => {
    const outcome = await profiles.resume(ctx.session.accountId);

    if (!outcome.ok) redirect("/publish");

    redirect("/my-profile?resumed=1");
  });
