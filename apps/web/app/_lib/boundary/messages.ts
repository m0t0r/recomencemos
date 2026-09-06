/**
 * Every `es-CO` string the three app-wide boundaries put in front of a person:
 * the nested error boundary, the root one, and the not-found page.
 *
 * Under `app/_lib` for the reason `session/` and `consent/` are — none of the
 * three is a route, and all three are read above every route group. The
 * authority is [`docs/policy/voice.md`](../../../../../docs/policy/voice.md) and
 * `boundary-copy.test.ts` beside this file puts every string under its countable
 * rules.
 *
 * **`global-error.tsx` may import this, and that is not a contradiction of what
 * that file says about itself.** It replaces the root *layout*, which costs it
 * the stylesheet and the fonts — not the module graph. Its colours are literal
 * because no stylesheet is mounted; its words have no such problem.
 *
 * **The tone here is the guide's `A refusal` row, not its own.** Optimism 3→4
 * and Energy 2→1: a failure is our rule and never her mistake, so every string
 * below names us as the actor and none of them asks her to do anything but the
 * one thing that might work.
 */

/* -------------------------------------------------------------------------- */
/* The nested boundary — `app/error.tsx`                                       */
/* -------------------------------------------------------------------------- */

/**
 * A segment failed inside a shell that rendered. The heading names the actor —
 * us — because the alternative reads as something she did, which is Don't 4 and
 * the refusal row of the tone matrix in one.
 */
export const APP_ERROR_TITLE = "Algo falló de nuestro lado";

/**
 * What to do, in the same breath as what happened (Do 3). It deliberately does
 * **not** promise that nothing was lost: this boundary sits above every route
 * and cannot know what the failed segment was holding, and a promise of a reach
 * we do not have is the failure ADR-0007 names in another register.
 */
export const APP_ERROR_EXPLANATION =
  "No es algo que hayas hecho tú. Volver a intentar suele servir.";

/* -------------------------------------------------------------------------- */
/* The root boundary — `app/global-error.tsx`                                  */
/* -------------------------------------------------------------------------- */

/**
 * The root layout itself failed, so nothing on screen is the product's shell.
 * The distinction from the nested boundary is real and is in the verb: there is
 * no segment left to retry, only the document to fetch again.
 */
export const ROOT_ERROR_TITLE = "No pudimos cargar la página";
export const ROOT_ERROR_EXPLANATION =
  "Algo falló de nuestro lado. Recargar la página suele servir.";

/**
 * A document with no title fails WCAG 2.4.2, and this boundary replaces the root
 * layout — so `metadata` is not in play and nothing else supplies one. It takes
 * the same shape every other title in the product does.
 */
export const ROOT_ERROR_PAGE_TITLE = "No pudimos cargar la página — Recomencemos";

/* -------------------------------------------------------------------------- */
/* Not found — `app/not-found.tsx`                                             */
/* -------------------------------------------------------------------------- */

/**
 * **This copy is read by four populations and may tell none of them which one
 * it is**, which is the constraint that shaped every word of it.
 *
 * Three of the four are the spec's `permission denied` cell answered as a 404 on
 * purpose — a caller who is not the owner at `/my-profile`, and a spent, expired
 * or unknown token at either of the two token routes, where the spec's own words
 * are that a legible refusal *"is an oracle for which tokens existed"*. The
 * fourth is someone who mistyped a URL. So: no sign-in prompt, no "did you mean",
 * and no distinction drawn between a page that never existed and one that is not
 * hers.
 */
export const NOT_FOUND_TITLE = "No encontramos esta página";

/** The tab, and the entry that survives in her history. Same sentence, same rule. */
export const NOT_FOUND_PAGE_TITLE = "No encontramos esta página — Recomencemos";

/**
 * **The hedge is the requirement, not weak writing.** Naming a cause would pick
 * one of the four populations out, and there is genuinely no way to tell them
 * apart from here. Confidence 4 in the guide keeps *no lo sabemos* sayable where
 * it is true, and this is where it is true.
 */
export const NOT_FOUND_EXPLANATION =
  "Puede que la dirección esté mal escrita o que esa página ya no esté.";

/** Where she can go instead (Do 3) — the one list this product opens on. */
export const NOT_FOUND_ONWARD = "En el muro están las personas que ofrecen su trabajo.";

/** Link text names its destination, never *aquí*. */
export const NOT_FOUND_LINK = "Ir al muro";

/* -------------------------------------------------------------------------- */
/* Shared                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The support reference, kept in the shape it had in English: this line is what
 * support asks for, and shortening it would cost the one word that says the
 * number is quotable rather than decorative.
 */
export const REFERENCE_TERM = "Referencia:";

/** The retry control on each boundary, and its in-flight label. */
export const APP_ERROR_RETRY = "Intentar de nuevo";
export const APP_ERROR_RETRYING = "Intentando";
export const ROOT_ERROR_RETRY = "Recargar";
export const ROOT_ERROR_RETRYING = "Recargando";

/** Body copy — everything under the twenty-word sentence ceiling. */
export const BOUNDARY_COPY = {
  APP_ERROR_TITLE,
  APP_ERROR_EXPLANATION,
  ROOT_ERROR_TITLE,
  ROOT_ERROR_EXPLANATION,
  ROOT_ERROR_PAGE_TITLE,
  NOT_FOUND_TITLE,
  NOT_FOUND_PAGE_TITLE,
  NOT_FOUND_EXPLANATION,
  NOT_FOUND_ONWARD,
} as const;

/** Labels and buttons — everything under the five-word ceiling. */
export const BOUNDARY_LABELS = {
  NOT_FOUND_LINK,
  REFERENCE_TERM,
  APP_ERROR_RETRY,
  APP_ERROR_RETRYING,
  ROOT_ERROR_RETRY,
  ROOT_ERROR_RETRYING,
} as const;
