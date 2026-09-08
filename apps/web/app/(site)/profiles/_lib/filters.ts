/**
 * What the URL is saying about the browsable list, read once and validated once.
 *
 * **The filter state lives in the query string and nowhere else.** That is what
 * makes a narrowed list shareable, what makes the back button undo a filter
 * rather than a keystroke, and what lets the whole control panel be a plain
 * `<form method="get">` with no client state to keep in step with it.
 *
 * **Every term is checked before it reaches a query, and an unreadable one is
 * dropped rather than refused.** A hand-edited URL should show the list, not an
 * error: nobody typed that query string on purpose, and there is nothing in it
 * for a reader to correct. The one thing that is *not* dropped is a well-formed
 * Skill slug naming no Skill — that reaches the read and matches nothing, which
 * is the honest answer to "show me the people who do a thing that does not
 * exist".
 *
 * **The page cursor is not here**, and that is the separation this module is
 * drawn around: `after` is where a reader is standing in the list, not something
 * they chose, so it is parsed by the page against the slug minter's own pattern
 * and it never makes the list "narrowed".
 *
 * Pure — no connection, no session, no clock — so `web:test` covers it directly.
 */

import { type CityId, isCityId } from "@repo/domain/policy";

/** The three terms a person can set, as the page and the domain read both take them. */
export interface BrowseFilters {
  readonly query: string;
  readonly skill: string | null;
  readonly city: CityId | null;
}

/**
 * How long a typed query may be before it is cut.
 *
 * Long enough for a sentence somebody meant, and short enough that a pasted
 * document does not become a hundred `LIKE` predicates. The cut is silent
 * because the alternative — refusing the search — is worse for a person whose
 * keyboard repeated.
 */
export const MAX_QUERY_LENGTH = 80;

/**
 * A `Skill` slug as the vocabulary spells one: lowercase words joined by
 * hyphens. Exported because the paging action parses the same term off a POST
 * body, and two spellings of "what a Skill slug is" would be two doors into one
 * read that disagreed about it.
 */
export const SKILL_SLUG = /^[a-z]+(?:-[a-z]+)*$/;

/** The query-string names, in one place, because the form and the links must agree. */
export const FILTER_KEYS = { query: "q", skill: "skill", city: "city", after: "after" } as const;

function oneOf(value: string | string[] | undefined): string {
  // A repeated parameter arrives as an array. The first is what the form would
  // have sent; the rest are somebody's URL editing.
  return (typeof value === "string" ? value : (value?.[0] ?? "")).trim();
}

export function browseFiltersFrom(
  params: Record<string, string | string[] | undefined>,
): BrowseFilters {
  const skill = oneOf(params[FILTER_KEYS.skill]);
  const city = oneOf(params[FILTER_KEYS.city]);

  return {
    query: oneOf(params[FILTER_KEYS.query]).slice(0, MAX_QUERY_LENGTH),
    skill: SKILL_SLUG.test(skill) ? skill : null,
    city: isCityId(city) ? city : null,
  };
}

/** Whether a person chose anything at all. */
export function isNarrowed(filters: BrowseFilters): boolean {
  return filters.query.length > 0 || filters.skill !== null || filters.city !== null;
}

/**
 * The filters as a URL, for the links that have to carry them — the paging link
 * above all, since a cursor names a row's place in an ordering and an ordering
 * over a different population is a different ordering.
 *
 * Empty terms are left out rather than written as `?q=`, so a shared URL says
 * only what somebody actually chose.
 */
export function browseHref(filters: BrowseFilters, after?: string | null): string {
  const params = new URLSearchParams();

  if (filters.query) params.set(FILTER_KEYS.query, filters.query);
  if (filters.skill) params.set(FILTER_KEYS.skill, filters.skill);
  if (filters.city) params.set(FILTER_KEYS.city, filters.city);
  if (after) params.set(FILTER_KEYS.after, after);

  const search = params.toString();
  return search ? `/profiles?${search}` : "/profiles";
}
