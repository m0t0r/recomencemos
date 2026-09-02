/**
 * A form refusal's `AppError.code` on the wire. Named here rather than in an
 * `actions.ts`, because a `"use server"` module may export only async functions
 * and the client-side feedback rule has to read the same spelling.
 *
 * **One per surface, not one per form**, so a browser can tell which form
 * refused: the two paths render different sentences above the summary, and a
 * shared code would make that read impossible.
 */
export const PUBLISH_REFUSED_CODE = "publish_refused";
export const PROFILE_UPDATE_REFUSED_CODE = "profile_update_refused";

/**
 * The Skill request's own refusal — a contact detail in the one field an Admin
 * reads. Distinct from the two above because it is rendered in a different
 * place by a different machine, and a shared code would have the picker's
 * message appear above the form's summary.
 */
export const SKILL_REQUEST_REFUSED_CODE = "skill_request_refused";
