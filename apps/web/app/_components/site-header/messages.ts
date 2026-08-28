/**
 * Every `es-CO` string the shell renders, in one module.
 *
 * No copy is written at a render site — the rule `/sign-in` set and the shape
 * brief repeats, so that a voice review reads one file per surface rather than
 * grepping JSX. Under `docs/policy/voice.md`, and under ADR-0012: these are
 * **values**, and every identifier around them stays English.
 */

/**
 * The product's name, which is a name and not copy.
 *
 * It is here rather than inlined so the header and any later chrome cannot
 * disagree about capitalisation, and so a voice review finds every rendered
 * string in one place — including the ones that turn out not to be sentences.
 */
export const PRODUCT_NAME = "Recomencemos";

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

/**
 * The header's own landmark name, for a screen reader listing landmarks.
 *
 * Two `<nav>`-shaped regions on a page need distinguishing, and this one is the
 * product's rather than a page's.
 */
export const HEADER_LANDMARK = "Barra de la cuenta";
