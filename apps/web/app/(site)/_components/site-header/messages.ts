/**
 * Every `es-CO` string the shell renders, in one module.
 *
 * No copy is written at a render site — the rule `/sign-in` set and the shape
 * brief repeats, so that a voice review reads one file per surface rather than
 * grepping JSX. Under `docs/policy/voice.md`, and under ADR-0012: these are
 * **values**, and every identifier around them stays English.
 */

/** Back to the Wall. Names its destination rather than saying "inicio". */
export const HOME_LINK_LABEL = "Recomencemos, ir al inicio";

/**
 * The way in, for someone with no session.
 *
 * The verb of its action, one word, and the same word `/sign-in`'s own
 * `<title>` uses — a person who followed a gate redirect and a person who
 * pressed this land on a page that names itself the same way.
 */
export const SIGN_IN = "Entrar";

/**
 * The way out.
 *
 * _Salir_ rather than _Cerrar sesión_: the guide caps a control at five words
 * and asks for the verb of the action, and this is the word a person on a phone
 * in Risaralda actually uses. It is the ticket's own word too.
 */
export const SIGN_OUT = "Salir";

/**
 * The way to `/account`.
 *
 * The same two words the page titles itself with (`app/account/_lib/messages.ts`
 * → `ACCOUNT_TITLE`), because link text names its destination
 * (`docs/policy/voice.md`) and a person who presses this should land on a page
 * that calls itself what the link called it.
 */
export const ACCOUNT = "Tu cuenta";

/**
 * The accessible name of the control that opens the session menu.
 *
 * The visible text inside it is her address, so the accessible name **contains**
 * the visible text — WCAG 2.2's Label in Name, which a bare "Menú" would fail.
 * What it adds is what the control is _for_, which the address alone does not
 * say.
 */
export function sessionMenuLabel(email: string): string {
  return `Tu sesión: ${email}`;
}

/**
 * Said above the address inside the open menu.
 *
 * **This is the borrowed-phone check, in one line.** DD5 has `/sign-in` name the
 * Google account it is about to use because on a shared Android it may be the
 * phone owner's; this is the same question answered afterwards, on every page,
 * for someone who has already signed in and is no longer sure whose account she
 * is in.
 */
export const SIGNED_IN_AS = "Entraste como";

/*
 * **There is deliberately no landmark name here any more.**
 *
 * It was `HEADER_LANDMARK = "Barra de la cuenta"`, set on the `<header>` in
 * *both* states — so signed out, a screen-reader user with no account was
 * announced into an account bar containing only the product name and _Entrar_.
 * True in the state its author had in mind, false in the other.
 *
 * The justification for naming it at all was "two `<nav>`-shaped regions need
 * distinguishing". There are not two: `<header>` at body level is already a
 * `banner` landmark, there is exactly one on the page, and the placeholder that
 * briefly renders a second is `aria-hidden`. ARIA asks for a name to tell
 * *several* landmarks of one type apart; with one, "banner" is the complete and
 * correct announcement.
 *
 * So the fix is not a truer noun — it is deleting a string that could be wrong
 * and was, in service of a distinction that does not exist. A name that cannot
 * be false beats a name that has to be kept true.
 */
