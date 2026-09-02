/**
 * `/profiles` — what makes the browsable list different from the Wall.
 *
 * **The ordering is named over the list, never over a card.** The list starts
 * with the people who have not received a proposal yet, and saying so is the
 * honest thing; saying it *about a person* would label her, which is the failure
 * mode `docs/policy/voice.md` exists to prevent. No card carries a count and no
 * card ever will.
 *
 * What the two lists share — the nobody-has-published pair, the two labels, the
 * grid's error copy — lives once in `../../_lib/lists/messages`.
 */

export const BROWSE_TITLE = "Todos los perfiles";

/** What this list is and how it is ordered, in one sentence about the list. */
export const BROWSE_LEAD =
  "Aquí están todas las personas que publicaron, empezando por quienes todavía no han recibido ninguna propuesta.";

/** The paging link. Names where it goes; never "más" on its own. */
export const BROWSE_MORE = "Ver más perfiles";

/**
 * The list is empty because of where the reader is standing in it, not because
 * there is nothing to show — so this names what is narrowing the list, and the
 * way out clears it rather than repeating the nobody-has-published sentence.
 */
export const BROWSE_NARROWED_TITLE = "No hay perfiles en esta parte de la lista";

export const BROWSE_NARROWED_BODY =
  "Llegaste con un enlace a una página que ya cambió. Los perfiles se reordenan cada día.";

/** While a page is in flight. The link stays a link; only its words change. */
export const BROWSE_MORE_LOADING = "Cargando…";

/**
 * The scroll stopped loading pages. Says what happened and what still works —
 * the link below it is a navigation rather than another call through the path
 * that just failed.
 */
export const BROWSE_MORE_FAILED =
  "No pudimos cargar más perfiles al bajar. Abre la página siguiente.";
