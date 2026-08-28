/**
 * Every Spanish string `/account` renders.
 *
 * One module rather than strings inline, for the reason `/sign-in` set: the copy
 * is the part of this surface with a binding standard behind it
 * ([`docs/policy/voice.md`](../../../../../docs/policy/voice.md)), and a
 * reviewer checking it against that standard should be reading one file rather
 * than grepping JSX.
 *
 * **The register on this surface is a refusal's, not a notice's** — Optimism
 * 3→4, Energy 2→1, Warmth 5 unchanged. She may be here because she is worried
 * about a machine she no longer controls, and the tone that serves her is calm
 * and factual: what is open, what closing it reaches, what happened.
 *
 * **The banned vocabulary that bites here**: _usuario/a_ (CONTEXT.md's Account
 * entry), and nothing on this page may describe her by anything that happened to
 * her.
 *
 * **No string here names hardware**, and that is a rule rather than a habit — see
 * {@link CURRENT_SESSION_MARKER} for the case that established it. A session is a
 * browser, so _dispositivo_, _aparato_ and _teléfono_ are each wrong in a
 * different direction: the first is institutional register, the second is vague,
 * and the third is false for the Hirer on a desktop who reads the same page. The
 * only place a device is named at all is {@link deviceLabel}, where the value
 * comes from the browser's own `User-Agent` rather than from us.
 */

export const ACCOUNT_TITLE = "Tu cuenta";

/** The `<title>`, which is read in a tab rather than on the page. */
export const ACCOUNT_PAGE_TITLE = "Tu cuenta — Recomencemos";

/**
 * Her address, named by **what it is for** rather than restated as a label.
 *
 * _"Tu cuenta es X"_ was the first draft and it is a caption: it tells her a
 * thing she already knows in a sentence that does no work. What is useful is
 * that this is the address we write to — which is why the magic link arrives
 * where it does, and where every later notification will go. Voice guide Do 1:
 * name what we actually do, present tense, actor visible.
 *
 * `nosotros` is legitimate here because the platform genuinely acts — we send
 * that mail. It is not _te acompañamos_.
 */
export function accountIs(email: string): string {
  return `Te escribimos a ${email}`;
}

export const SESSIONS_HEADING = "Sesiones abiertas";

/**
 * **Teaches the term through the scene rather than defining it.** Nothing here
 * says what a session *is*; it names the situation she would recognise, and the
 * word is learned from the sentence around it. 18 words, inside the 20-word
 * bound.
 */
export const SESSIONS_EXPLANATION =
  "Si entraste desde un computador o un teléfono prestado, esa sesión sigue abierta hasta que la cierres.";

/**
 * The row she is reading this on, which is the one she cannot close from here.
 *
 * **It names no device, and that is a correctness fix rather than a preference.**
 * The first draft said _"Este aparato"_, and a session is not a device — it is a
 * browser. Open Chrome and Firefox on one laptop and there are two rows, one
 * marked _"Este aparato"_, which tells her the other one is somewhere else. It
 * is not. The label was false in a case a person actually reaches.
 *
 * **`teléfono` would be false in the other direction**, which is worth recording
 * because it is the product's own word four times over (`SHARED_DEVICE_LABEL`
 * and the magic-link copy). Those four are addressed to a Worker signing in on a
 * phone and are right where they stand; this string is read by a Hirer on a
 * desktop and by a Worker at a cybercafé too, and naming a phone to either is a
 * small lie at the moment they are deciding what to close. `dispositivo` is
 * institutional register and fails Sophistication 2. #80 reached the same
 * conclusion from the other side and made its own string device-neutral.
 *
 * So the marker carries **position, not taxonomy** — which is also what the row
 * needs, because the heading beside it already names the browser. The voice
 * guide asks for the verb before the classifying noun, and this is that rule
 * applied to two words.
 */
export const CURRENT_SESSION_MARKER = "Estás aquí";

/**
 * The common case, and it must not read as a failure or as an error state.
 * Nothing is wrong; there is simply nothing to close.
 */
export const ONLY_THIS_SESSION = "Esta es tu única sesión abierta. No hay nada más que cerrar.";

/**
 * What a row says when the browser sent nothing we could read.
 *
 * **Honest rather than a placeholder that looks like a device name.** _"Un
 * navegador"_ would read as a name; this says what is true — we do not know —
 * without dressing the absence up. Voice guide Confidence 4: _no lo sabemos_ has
 * to stay sayable where it is true.
 */
export const UNKNOWN_DEVICE = "No sabemos qué navegador es";

/** `Chrome en Android`, or just `Chrome` where the platform is unfamiliar. */
export function deviceLabel(browser: string | null, platform: string | null): string {
  if (browser && platform) return `${browser} en ${platform}`;
  if (browser) return browser;
  if (platform) return platform;
  return UNKNOWN_DEVICE;
}

/**
 * The button, which is also the confirmation.
 *
 * **The count is in the label on purpose.** There is no dialog on this surface
 * (`.impeccable/briefs/account.md`), and this is what carries the weight one
 * would have: she reads the number directly under the rows it refers to. Both
 * forms stay inside the 5-word bound for a button.
 */
export function closeOthersButton(count: number): string {
  return count === 1 ? "Cerrar la otra sesión" : `Cerrar las otras ${count}`;
}

/**
 * The success sentence, quoting the count back at her (voice guide, Do 4).
 *
 * **The second half is the load-bearing one.** Without _"Esta sigue abierta"_ a
 * person who has just closed sessions cannot tell whether she is about to be
 * signed out, and the whole reason the current session survives is that she
 * keeps working. One exclamation mark is permitted in a success state; this one
 * does not need it.
 */
export function closedOthers(count: number): string {
  const closed = count === 1 ? "Cerramos la otra sesión." : `Cerramos ${count} sesiones.`;
  return `${closed} Esta sigue abierta.`;
}

/** Where the announcement lands, named for a screen reader rather than for a sighted reader. */
export const FEEDBACK_REGION_LABEL = "Resultado";
