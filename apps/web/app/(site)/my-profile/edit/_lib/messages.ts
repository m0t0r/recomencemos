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

/**
 * The way out without saving. A link, because it navigates.
 *
 * **"Sin guardar" is the load-bearing half, so the destination is the half that
 * gives.** There is no unsaved-changes prompt on this form, so leaving really
 * does drop what she has typed since her last save — a link that read *Volver a
 * mi perfil* would be neutral navigation in front of a Worker who is about to
 * lose a correction. Five words is the ceiling for a control and *Volver a mi
 * perfil sin guardar* is six, which is what forced the choice.
 */
export const BACK_TO_PROFILE = "Volver sin guardar";

/**
 * The photo's place on this form, which is a sentence rather than a control —
 * the same shape `/publish` uses and a different fact. Saying nothing at all
 * would read as though editing had lost it.
 *
 * **It names no other place, because there is not one yet.** Swapping a photo
 * is `attachPhoto`'s and ships separately; a sentence sending her to a control
 * that does not exist would be the failure this surface has already had to
 * repair once, in the Skill request's copy. What this says is only what is
 * true: not on this form.
 *
 * It ends on the form rather than on *aquí* for a second reason the copy gate
 * found: a sentence ending in *aquí.* is on the voice guide's empty-link-text
 * list, and a rule that only catches link text would be a rule with a hole in
 * it.
 */
export const PHOTO_CHANGED_ELSEWHERE = "Tu foto no se cambia en este formulario.";

/** A transport fault, not a refusal: what failed, that nothing was lost, that retrying helps. */
export const SAVE_FAILED =
  "No pudimos guardar tus cambios. Nada de lo que escribiste se perdió. Inténtalo de nuevo en un momento.";

/**
 * The copy gate's population, in the two groups `docs/policy/voice.md` counts
 * separately: body copy to twenty words a sentence, labels and controls to
 * five. `edit-copy.test.ts` beside this file is what reads them.
 */
export const EDIT_COPY = {
  EDIT_TITLE,
  EDIT_INTRO,
  PHOTO_CHANGED_ELSEWHERE,
  SAVE_FAILED,
} as const;

export const EDIT_LABELS = {
  SAVE_BUTTON,
  BACK_TO_PROFILE,
} as const;
