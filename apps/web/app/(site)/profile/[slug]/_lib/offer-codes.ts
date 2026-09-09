/**
 * The `AppError.code`s the Offer form raises, named beside each other so the
 * server that raises one and the client that reads it spell it once.
 *
 * **Two rather than one, and the split is what the browser needs.**
 * `OFFER_REFUSED_CODE` carries a per-field tree and the form renders it beside
 * the fields; `OFFER_UNAVAILABLE_CODE` is a refusal about *him or her* — Blocked,
 * frozen, banned, a profile that went away, his own profile — which belongs in
 * the feedback region above the form because no field is wrong.
 */

/** A field was refused: the rejector, an unreadable number, a missing name. */
export const OFFER_REFUSED_CODE = "offer_refused";

/** He may not send this Offer at all. Nothing he typed is the problem. */
export const OFFER_UNAVAILABLE_CODE = "offer_unavailable";
