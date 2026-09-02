/**
 * `@repo/domain/policy` — the pure rules. Nothing here opens a connection, reads
 * a clock, or imports a module that does, which is what makes every one of them
 * seam 1's and what lets `apps/web` call them from a Server Action without a
 * handle.
 *
 * The contact-detail rejector (DD3), the phone normalizer, the search normalizer
 * (DD4) and the city registry (DD2). The Offer state machine and the list
 * ordering (NFR22) arrive here with the stories that need them.
 */

export { CITIES, CITY_IDS, type CityId, cityLabel, isCityId } from "#policy/cities";
export {
  type ContactDetailKind,
  type ContactDetailVerdict,
  rejectContactDetails,
} from "#policy/contact-details";
export { formatColombianPhone, normalizeColombianPhone, type PhoneVerdict } from "#policy/phone";
export { normalizeSearchText } from "#policy/search-text";
