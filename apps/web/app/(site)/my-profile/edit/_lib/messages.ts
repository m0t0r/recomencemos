/**
 * What `/my-profile/edit` says, in `es-CO` — only the strings that are this
 * surface's own. Every field label, help line and refusal is shared with
 * `/publish` and lives in `@/app/_lib/profile-form/messages`, because a field
 * that renamed itself between publishing and editing would be a different
 * field to the person reading it.
 *
 * Under `docs/policy/voice.md`. Two things it deliberately does not say:
 *
 * - **Anything about position on the Wall.** An edit does not move her, which
 *   is a promise the site keeps to everyone else; saying so here would teach a
 *   Worker that moving up is a thing this site does, and it is not.
 * - **Anything about review or approval.** Nothing on this form waits on a
 *   person. The photo does, and the photo is not on this form.
 */

/** The browser tab. The product name last, as every other page has it. */
export const EDIT_PAGE_TITLE = "Cambia tu perfil — Recomencemos";

/** The `<h1>`. Her profile, her change — the verb is hers. */
export const EDIT_TITLE = "Cambia tu perfil";

/**
 * Under the heading. Says the two things she needs before she starts: the
 * change is live when she saves, and the link people already have keeps
 * working. The second is the reassurance NFR9 exists to make true.
 */
export const EDIT_INTRO =
  "Lo que cambies queda al instante. El enlace de tu perfil sigue siendo el mismo.";

/** The button says the verb of its action, as `/publish`'s does. */
export const SAVE_BUTTON = "Guardar cambios";

/** The way out without saving. A link, because nothing is being discarded. */
export const BACK_TO_PROFILE = "Volver a mi perfil sin guardar";

/**
 * The photo's place on this form, which is a sentence rather than a control —
 * the same shape `/publish` uses and a different fact. There, the photo comes
 * after publishing; here, it is changed on the profile page rather than in
 * this form, and saying nothing at all would read as though editing had lost
 * it.
 */
export const PHOTO_CHANGED_ELSEWHERE = "Tu foto se cambia desde tu perfil, no desde aquí.";

/** A transport fault, not a refusal: what failed, that nothing was lost, that retrying helps. */
export const SAVE_FAILED =
  "No pudimos guardar tus cambios. Nada de lo que escribiste se perdió. Inténtalo de nuevo en un momento.";
