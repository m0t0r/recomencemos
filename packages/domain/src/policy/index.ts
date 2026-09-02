/**
 * `@repo/domain/policy` — the pure rules. Nothing here opens a connection, reads
 * a clock, or imports a module that does, which is what makes every one of them
 * seam 1's and what lets `apps/web` call them from a Server Action without a
 * handle.
 *
 * The contact-detail rejector (DD3), the phone normalizer, the search normalizer
 * (DD4), the city registry (DD2) and the two list orderings — the Wall's, and
 * the attention spread the browsable list commits to. The Offer state machine
 * arrives here with the story that needs it.
 */

export { CITIES, CITY_IDS, type CityId, cityLabel, isCityId } from "#policy/cities";
export {
  type ContactDetailKind,
  type ContactDetailVerdict,
  rejectContactDetails,
} from "#policy/contact-details";
/*
  **The two orderings and the pager are not published, only the types a caller
  needs to name.** `profiles.wall()` and `profiles.browse()` are the door to both
  lists, exactly as `profiles/index.ts` argues when it declines to re-export
  `listWall`/`listBrowse` — publishing the comparators here would put a second,
  handle-free way to reorder a list on the public subpath, which is the widening
  ADR-0010 exists to refuse. Every consumer reaches them through `#policy/listing`,
  which is private to this package.
*/
export type { AttentionSpreadOrder, NewestOrder } from "#policy/listing";
export { formatColombianPhone, normalizeColombianPhone, type PhoneVerdict } from "#policy/phone";
export {
  PHOTO_STATES,
  type PhotoState,
  PROFILE_STATES,
  type ProfileState,
} from "#policy/profile-states";
export { normalizeSearchText } from "#policy/search-text";
export { SKILL_REQUEST_STATES, type SkillRequestState } from "#policy/skill-request-states";
