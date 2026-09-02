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
export {
  type AttentionSpreadOrder,
  compareByAttentionSpread,
  compareByNewest,
  type NewestOrder,
  type Page,
  PAGE_SIZE,
  pageOf,
} from "#policy/listing";
export { formatColombianPhone, normalizeColombianPhone, type PhoneVerdict } from "#policy/phone";
export {
  PHOTO_STATES,
  type PhotoState,
  PROFILE_STATES,
  type ProfileState,
} from "#policy/profile-states";
export { normalizeSearchText } from "#policy/search-text";
