/**
 * The two identifiers the `<noscript>` rule and the components have to agree on.
 *
 * They live in a module of their own because the agreement is invisible: the
 * rule is a **string of CSS** built in `site-header.tsx` and the targets are
 * attributes on elements in `session-menu.tsx`, so nothing type-checks the pair
 * and a rename on one side fails silently — the fallback stays hidden and
 * *Salir* is unreachable with JavaScript off, which is the one state nobody
 * looks at.
 *
 * English identifiers holding no Spanish, per ADR-0012.
 */

/**
 * The `id` both sign-out triggers name.
 *
 * A submit button needs no ancestor `<form>` when it names one by id, which is
 * what lets the menu item (portalled to the body) and the fallback button (in
 * the header) submit the same form.
 */
export const SIGN_OUT_FORM_ID = "sign-out";

/** The `data-slot` on the menu, hidden when scripting is off. */
export const SESSION_MENU_SLOT = "session-menu";

/** The `data-slot` on the plain button, revealed when scripting is off. */
export const SESSION_MENU_FALLBACK_SLOT = "session-menu-fallback";
