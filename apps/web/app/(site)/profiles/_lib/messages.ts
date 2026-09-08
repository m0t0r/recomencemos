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

/*
  The filters.

  **The words are about what she does, never about who anybody is.** The box asks
  what work you are looking for; the two lists narrow by capability and by city.
  Nothing here classifies a person, and nothing here counts anything about one.
*/

/** The group's own name, for the region that holds the three controls. */
export const FILTERS_LEGEND = "Buscar en la lista";

export const FILTER_TEXT_LABEL = "Qué trabajo buscas";

/**
 * The placeholder is an example rather than a repeat of the label, which is what
 * makes it worth its cost: a placeholder that restates the label disappears the
 * moment someone types and takes the only hint with it.
 */
export const FILTER_TEXT_PLACEHOLDER = "Panadería, pintar, cuidar niños…";

/** Says the accents are optional, because a Hirer abroad has no ñ on his keyboard. */
export const FILTER_TEXT_HINT = "Da lo mismo si escribes con tildes o sin ellas.";

export const FILTER_SKILL_LABEL = "Capacidad";
export const FILTER_CITY_LABEL = "Ciudad";

/** What each control reads before anything is chosen. Never "Todas" on its own. */
export const FILTER_ANY_SKILL = "Cualquier capacidad";
export const FILTER_ANY_CITY = "Cualquier ciudad";

/**
 * The one option the Skill list holds while its own list is still arriving.
 *
 * The control is already on screen and already submittable — `Cualquier
 * capacidad` is above this and is what an unfiltered search sends — so this says
 * what is missing rather than that anything is unavailable.
 */
export const FILTER_SKILLS_LOADING = "Cargando las capacidades…";

/** The verb, and what it acts on. */
export const FILTER_SUBMIT = "Buscar";

/**
 * While the narrowed list is on its way.
 *
 * The previous results stay on screen through the transition, so this is the
 * only thing that says a new list is coming — the same reason the search region
 * carries `aria-busy`.
 */
export const FILTER_SEARCHING = "Buscando…";

/** Shown only when something is narrowing the list. Says what it undoes. */
export const FILTER_CLEAR = "Quitar los filtros";

/**
 * Nothing matched what was chosen.
 *
 * **It names what is narrowing the list and offers to clear it**, which is the
 * spec's `empty` cell for this surface and the thing that makes it a different
 * state from the Wall's. {@link narrowedBy} builds the naming from the filters
 * that are actually set, so the sentence never lists one nobody chose.
 */
export const FILTER_EMPTY_TITLE = "No hay perfiles que coincidan";

/**
 * **The narrowing is listed rather than woven into a sentence**, and that is a
 * decision about grammar rather than about style: a Skill label, a city name and
 * a phrase somebody typed do not share a preposition, so any sentence that tried
 * to join them would be ungrammatical for two of the three combinations. Listing
 * them says exactly the same thing and stays right whichever ones are set.
 *
 * @param terms what is narrowing the list, in the order the controls sit, and
 * already in the words a person reads — the typed words quoted by
 * {@link typedTerm}, a Skill as its label, a city as its name.
 */
export function narrowedBy(terms: readonly string[]): string {
  return `Estás filtrando por ${terms.join(", ")}. Prueba con menos filtros o con otra palabra.`;
}

/** The words she typed, as one of {@link narrowedBy}'s terms. */
export function typedTerm(query: string): string {
  return `“${query}”`;
}
