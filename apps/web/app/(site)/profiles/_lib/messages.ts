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

/**
 * PROTOTYPE — variant C's framing, which names why the list exists rather than
 * how it sorts. It goes with the losing variants unless C wins.
 */
export const BROWSE_LEAD_QUIET = "Aquí están todas, no solo las que publicaron hoy.";

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
