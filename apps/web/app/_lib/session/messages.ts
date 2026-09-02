/**
 * The one sentence every signed-in surface shares: what an action says when
 * the session behind it has gone.
 *
 * Under `app/_lib` rather than a route folder because more than one surface
 * reads it — `/publish` today, the Offer surfaces next — and a refusal that is
 * worded two ways is two refusals. The authority is
 * [`docs/policy/voice.md`](../../../../../docs/policy/voice.md); the publish
 * copy test puts it under the countable rules.
 */

/**
 * What happened and what to do, in one breath. An expired cookie is ordinary —
 * she may have left the form open for an hour — so this is a plain instruction,
 * never an accusation, and it says nothing about *why* the session ended.
 */
export const SESSION_REQUIRED = "Tu sesión ya no está abierta. Entra otra vez para seguir.";
