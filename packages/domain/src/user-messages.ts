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
 *
 * **It names no device, and that is the correction rather than the compromise.**
 * The first version said _dispositivo_, which is institutional register and
 * fails Sophistication 2. The obvious repair is `teléfono`, which is what this
 * product already says four times — `SHARED_DEVICE_LABEL` ("Este no es mi
 * teléfono"), the hint beside it, the sent-state hint, and the magic-link email.
 * That vocabulary is right where it stands, because all four are addressed to a
 * Worker signing in on a phone.
 *
 * This string is not, for two reasons, and the second is the stronger one.
 *
 * **Both sides read it.** A Hirer in Madrid meeting _"sigue abierta en este
 * teléfono"_ on a desktop is told something false at the exact moment he is
 * deciding whether he is still signed in.
 *
 * **And a session is a browser, not a device.** Open Chrome and Firefox on one
 * laptop and there are two sessions on one machine, so *every* hardware noun —
 * `teléfono`, `aparato`, `dispositivo` — is false there, and not vaguely: it
 * says the other session is somewhere else when it is a window away. That is a
 * case a person actually reaches, and no amount of picking a better noun fixes
 * it.
 *
 * So `aquí` is not a compromise between the nouns. It names **position rather
 * than hardware**, which is what a session actually has. The force was never in
 * the noun — it was in saying plainly that the session did not close.
 */
export const SIGN_OUT_FAILED = "No pudimos cerrar tu sesión. Sigue abierta aquí. Intenta de nuevo.";

/**
 * The action needed a session and there was none.
 *
 * Reached when a session expired or was revoked between the page rendering and
 * the form submitting — which on `/account` is not exotic: a Worker can be
 * looking at this exact surface when a session she started elsewhere runs out.
 * So it says the ordinary true thing and what to do about it, rather than
 * treating an expiry as a fault (`docs/policy/voice.md`, Don't 4).
 */
export const SESSION_REQUIRED = "Tu sesión ya no está abierta. Entra otra vez para seguir.";

/**
 * Sign-out-everywhere broke on our side.
 *
 * **The second sentence is the load-bearing one.** A failure here leaves the
 * other sessions open, and a person who is closing a session on a machine she no
 * longer controls has to be told that plainly rather than left to assume it
 * worked. Directness 5, and the refusal says what to do next in the same breath
 * (Do 3).
 */
export const SIGN_OUT_EVERYWHERE_FAILED =
  "No pudimos cerrar las otras sesiones. Siguen abiertas. Intenta de nuevo.";
