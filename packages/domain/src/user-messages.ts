/**
 * The Spanish strings this package is allowed to put in front of a person.
 *
 * `userMessage` is the only string permitted to reach a browser, and under
 * [ADR-0012](../../../docs/adr/0012-spanish-is-the-interface-english-is-the-code.md)
 * it is the one kind of string here that is Spanish — every identifier around it
 * stays English. Collected in one module rather than written at each throw site
 * so that the same failure reads the same way wherever it is raised, which is
 * the whole reason a person can be told anything useful by a system with several
 * ways of breaking.
 */

/**
 * Everything that means "the database did not answer": a missing connection
 * string, a refused connection, a round trip that failed. They are one event to
 * the reader and the distinction between them is the operator's, which is what
 * `message` carries.
 */
export const SERVICE_UNAVAILABLE =
  "El servicio no está disponible en este momento. Intenta de nuevo en un momento.";

/**
 * A sign-in that broke on our side rather than on hers.
 *
 * **Not** what a consumed or expired link says — that is an ordinary outcome
 * with its own copy on `/sign-in`, and calling it an error would make our rule
 * read as her mistake (`docs/policy/voice.md`, Don't 4). This is the string for
 * a door that failed: an unknown path minting a session, a provider that broke.
 *
 * Names the other door, because the refusal tone is Optimism 3→4 and the whole
 * design of this surface is that neither door is ever a dead end.
 */
export const SIGN_IN_FAILED =
  "No pudimos entrar a tu cuenta. Intenta de nuevo, o entra con la otra opción.";

/**
 * Sign-out failed, and the session is still open.
 *
 * **The second sentence is the load-bearing one.** The person most likely to
 * meet this string is NFR13's shared-device Worker — she pressed _Salir_ on a
 * phone that is not hers and is about to hand it back. Telling her only that
 * something failed would leave her to assume the safe thing, and the safe thing
 * is not what happened. Directness 5, and the absence stated first
 * (`docs/policy/voice.md`, Do 2 and Do 3): what happened, what is true now, what
 * to do.
 */
export const SIGN_OUT_FAILED =
  "No pudimos cerrar tu sesión. Sigue abierta en este dispositivo. Intenta de nuevo.";
