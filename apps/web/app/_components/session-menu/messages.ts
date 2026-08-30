/**
 * The session menu's own `es-CO` strings.
 *
 * **They moved here with the component when `/admin` became its second caller**
 * (#17). They were in `site-header/messages.ts`, which is still where the strings
 * that belong to the *site* shell live — the product name, the Wall's link label,
 * _Entrar_. What sits here is what the menu itself renders, so a shell reusing the
 * menu does not have to reach into another shell's copy to get it.
 *
 * Under `docs/policy/voice.md`, and under ADR-0012: these are **values**, and
 * every identifier around them stays English.
 */

/**
 * The way out.
 *
 * _Salir_ rather than _Cerrar sesión_: the guide caps a control at five words
 * and asks for the verb of the action, and this is the word a person on a phone
 * in Risaralda actually uses. It is the ticket's own word too.
 *
 * The Admin's shell says the same word, because it is the same act.
 */
export const SIGN_OUT = "Salir";

/**
 * The way to `/account`.
 *
 * The same two words the page titles itself with (`app/(site)/account/_lib/messages.ts`
 * → `ACCOUNT_TITLE`), because link text names its destination
 * (`docs/policy/voice.md`) and a person who presses this should land on a page
 * that calls itself what the link called it.
 *
 * Only rendered where a caller passes an `accountHref`. `/admin`'s shell does
 * not: `/account` is the *Worker's* own Account, under a different shell, and a
 * row that navigated out of the queue is the one part of this menu that would be
 * wrong above a moderation surface.
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
 *
 * It reads the same above `/admin`, where the question is not "is this the phone
 * owner's" but "is this the account that can read every phone number in the
 * system" — the same answer, wanted for a different reason.
 */
export const SIGNED_IN_AS = "Entraste como";
