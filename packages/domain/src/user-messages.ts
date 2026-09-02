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
 * **It says "todas" rather than claiming they are all still open**, and the
 * precision is the point. The revocation deletes rows under a `Promise.all`, so
 * a fault can leave *some* closed and others not — a sentence asserting they all
 * survived would be false in exactly the case a person most needs the truth.
 * This one is true of a total failure and a partial one alike.
 *
 * It then sends her to the evidence rather than to a retry alone: the list
 * re-renders on the same page, so "revisa la lista" is a step she can actually
 * take. Directness 5, and the refusal says what to do next in the same breath
 * (Do 3).
 */
export const SIGN_OUT_EVERYWHERE_FAILED =
  "No pudimos cerrar todas las otras sesiones. Revisa la lista e intenta de nuevo.";

/**
 * A passwordless door refused because the Account holds the Admin grant (NFR14).
 *
 * **Only an operator can ever read this string**, and that shapes it: it is not
 * a refusal aimed at a Worker who did nothing wrong, it is a signpost aimed at
 * someone who reached for the wrong door out of habit. So it says what to do
 * instead, which is the whole of what they need.
 *
 * It says "an operator" and not "the operator" deliberately — this product has
 * more than one Admin, so nothing here may be written as though the reader were
 * a particular person.
 *
 * **It names no route, and it stopped naming one when the Admin's door stopped
 * having a page.** It used to send the reader to `/admin/sign-in` with a
 * password; there is no such page and no such password. What it points at now is
 * the form the reader is already looking at — the Admin asks for a link there
 * like anybody else, and the link that arrives is the one that works.
 *
 * **It names no door either, and that is the second draft rather than the
 * first.** It said _"no entra con Google"_ while the rule refused only the two
 * passwordless doors; the rule is now every door that is not the Admin's, so the
 * same sentence is read by someone who typed a password. One sentence for every
 * refused door is also what stops the difference between them being the
 * disclosure.
 *
 * **It names no account and asks no question.** The sentence has to be true and
 * useless in the hands of someone who is not the Admin — _"esta cuenta"_ says
 * nothing that whoever provoked it did not already know, and naming the address
 * or the grant would.
 *
 * Directness 5 and the refusal is our rule rather than her mistake
 * (`docs/policy/voice.md`, Do 3 and Don't 4): what happened, and what to do next,
 * in one breath.
 */
export const ADMIN_SIGN_IN_ONLY =
  "Esta cuenta no entra por aquí. Pide un enlace con tu correo y entra con él.";

/**
 * `revokeSessions` was asked for an address with no Account.
 *
 * Read only by the Admin, who is the one principal permitted to learn that an
 * address has no Account — the enumeration rule that shapes `/sign-in`'s copy is
 * about an anonymous caller, and this is the opposite of one.
 */
export const ADMIN_ACCOUNT_NOT_FOUND = "No hay ninguna cuenta con ese correo.";

/**
 * The three ways promoting a requested capability can be refused, and they are
 * three strings because they are three different situations for the person
 * reading them.
 *
 * All three are read only by an Admin, on a screen they are working through, so
 * each says what is true of the queue now and what the next move is — a refusal
 * that only said "no" would leave them re-reading a row that has already changed
 * under them.
 */

/** The request is not there at all: resolved and swept, or never that id. */
export const ADMIN_SKILL_REQUEST_GONE = "Esa solicitud ya no está. Vuelve a cargar la página.";

/**
 * Somebody already resolved it — the second Admin's case, and the reason the row
 * is read under a lock. It names the other person's work rather than an error,
 * because that is what happened.
 */
export const ADMIN_SKILL_REQUEST_RESOLVED =
  "Otra persona ya resolvió esa solicitud. Vuelve a cargar la página.";

/**
 * The English identifier collides with an entry the vocabulary already holds.
 * The next step is a different identifier, and it is in the same breath (Do 3).
 */
export const ADMIN_SKILL_SLUG_TAKEN =
  "Ya hay una capacidad con ese identificador. Escribe otro y vuelve a intentarlo.";

/**
 * An Admin action that broke on our side.
 *
 * **The second sentence is the one that matters**, and it is true by
 * construction: NFR33 puts the `AdminAction` insert in the same transaction as
 * the action itself, so a failure rolls back both. The Admin can retry knowing
 * the queue has not half-moved underneath them.
 */
export const ADMIN_ACTION_FAILED = "No pudimos completar la acción. Nada cambió; intenta de nuevo.";

/**
 * The second factor was refused: a wrong code, an expired challenge, or an
 * account locked after ten consecutive failures.
 *
 * **The recovery path is in the sentence**, which is the half that earns it. An
 * Admin who has lost the phone is exactly the person meeting this string, and
 * DD5's ten printed backup codes are useless if nothing on screen says they work
 * here (C43: losing the second factor stops every Offer and leaves every reported
 * Hirer frozen). Do 3 — the refusal says what to do next in the same breath.
 */
export const ADMIN_SECOND_FACTOR_REFUSED =
  "Ese código no sirve. Prueba otra vez, o usa uno de tus códigos de respaldo.";

/**
 * The *aviso de privacidad* or the *autorización* changed while she had the form
 * open, so the consent she is submitting is to text that is no longer the one in
 * force.
 *
 * **It says what happened and what to do, and it does not call it an error.** The
 * change was ours; she filled in a form correctly and slowly, which is exactly
 * what a person on a borrowed phone does. Do 3 and Don't 4 in
 * `docs/policy/voice.md`: the refusal is our rule rather than her mistake, and
 * the next step is in the same breath.
 *
 * **It sends her back to read rather than straight to retry**, which is the whole
 * point of refusing: a reload that silently re-submitted would record consent to
 * a document she still has not seen.
 */
export const CONSENT_VERSION_STALE =
  "Cambiamos el aviso de privacidad mientras llenabas el formulario. " +
  "Vuelve a cargar la página y léelo antes de seguir.";
