/**
 * The publish refusal's `AppError.code` on the wire. Named here rather than in
 * `actions.ts`, because a `"use server"` module may export only async functions
 * and the client-side feedback rule has to read the same spelling.
 */
export const PUBLISH_REFUSED_CODE = "publish_refused";

/**
 * The Skill request's own refusal — a contact detail in the one field an Admin
 * reads. Distinct from the publish refusal because the two are rendered in
 * different places by different machines, and a shared code would have the
 * picker's message appear above the form's summary.
 */
export const SKILL_REQUEST_REFUSED_CODE = "skill_request_refused";
