/**
 * Every `es-CO` string the second-factor screen renders.
 *
 * The authority is [`docs/policy/voice.md`](../../../../../docs/policy/voice.md),
 * and this is an **Admin surface** in its tone matrix: Warmth 5→2,
 * Sophistication 2→4. One person, once a day, at a desk, who wants to be past
 * this screen — so there is no reassurance here and nothing that describes the
 * reader.  `continue-copy.test.ts` enforces the countable rules.
 *
 * **Nothing here says "admin", names a route, or shows an address.** Whoever
 * opened the link already knows whose mailbox it arrived in; nobody else may be
 * told, and a page that named the surface behind it would undo the reason that
 * surface has no door of its own. The refusals are not here at all — they come
 * back from `@repo/domain`, which is where one sentence is built for six
 * different failures precisely so that no caller can spell a seventh.
 */

/**
 * The browser tab.
 *
 * It names the act and the product and stops. A tab title is the one string that
 * survives into a screenshot, a shared window and a browser's history, which is
 * exactly the set of places the surface brief's anti-goals are about.
 */
export const CONTINUE_PAGE_TITLE = "Escribe tu código — Recomencemos";

/** The page's one `<h1>`. The verb, and nothing about who is reading it. */
export const CONTINUE_TITLE = "Escribe tu código";

/** The label on the one field. */
export const CODE_LABEL = "Tu código";

/**
 * **The half that keeps the recovery path from being one nobody is told about.**
 *
 * One field takes either credential, told apart by shape on the server — so
 * somebody whose phone is gone, wiped or lost is looking at a box with nothing
 * obvious to type, and gets no lockout message to explain it. This sentence is
 * what rescues them, and it is the reason the field has a description at all.
 *
 * It names both in the words the enrolment screen already used — _app de
 * autenticación_ and _códigos de respaldo_ — so nothing here is a name only its
 * authors can resolve.
 */
export const CODE_DESCRIPTION =
  "Los seis dígitos de tu app de autenticación, o uno de tus códigos de respaldo.";

/** A button says the verb of its action. Not `Continuar`, which names none. */
export const SUBMIT_BUTTON = "Entrar";

/**
 * Something broke on our side.
 *
 * **It says nothing changed and puts that first**, which is the whole of what
 * the reader needs: the failure is ours, retrying costs nothing, and the code is
 * still in the field. Directness 5 puts the fact before the offer to try again,
 * because it is the fact that makes the offer safe.
 *
 * It is deliberately distinct from the refusal `@repo/domain` returns for a code
 * that did not check out. Collapsing the two would tell somebody holding a
 * correct code that their code was wrong, and send them looking for a printed
 * one they do not need.
 */
export const CONTINUE_FAILED = "No pudimos revisar tu código. Nada cambió; intenta de nuevo.";

/** Every string above, for the copy test. Adding one here puts it under the rules. */
export const CONTINUE_COPY = {
  CONTINUE_PAGE_TITLE,
  CONTINUE_TITLE,
  CODE_LABEL,
  CODE_DESCRIPTION,
  SUBMIT_BUTTON,
  CONTINUE_FAILED,
} as const;

/** The ones the voice guide holds to five words. */
export const CONTINUE_LABELS = {
  CODE_LABEL,
  SUBMIT_BUTTON,
} as const;
