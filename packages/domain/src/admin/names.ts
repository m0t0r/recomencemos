/**
 * The names of the Admin actions, and nothing else.
 *
 * **A leaf module on purpose.** It imports nothing, because both ends of NFR33's
 * mechanism have to read it and they cannot read each other: `#schema` writes the
 * `CHECK` on `admin_action.action` from this list, and `#admin/handlers` declares
 * its handler map as `Record<AdminActionName, …>` so the compiler refuses a
 * registry that has drifted from it. Put the names beside the handlers and
 * `#schema` would import the handlers; put them beside the table and the registry
 * would import Drizzle. Neither is worth it for a list of names.
 *
 * **This is the list NFR33 counts against.** _"**100%** of the eleven `/admin`
 * actions write an `AdminAction` row in the same transaction as the action
 * itself"_ — eleven is the number the finished product has, and six is the
 * number that exists today. Four of the remaining five wait on an entity no story
 * has created yet: `resolveReport`, `unfreezeHirer` and `banHirer` all need the
 * Report, and `takeDownProfile` needs the takedown. They arrive with their story
 * — a name here, a handler in the registry, and nothing else — because the
 * `CHECK` follows from the name and the audit follows from the executor, which is
 * the whole point of the shape. The last one, `declineSkill`, needs no entity at
 * all and is the absence explained below.
 *
 * **`deliverOffer` and `rejectOffer` are the queue's one decision, seen from its
 * two sides**, and they arrived one story apart for a reason worth keeping.
 * Delivery came with story 6, because an Offer nobody can deliver is an Offer
 * that only accumulates and NFR7's age-of-oldest would then measure how long the
 * feature had been half-built. Refusal came with the Admin section that renders
 * the row it refuses, which is the same argument `declineSkill` is still waiting
 * on: an action needs a place to be pressed before it needs to exist.
 *
 * **Refusal is terminal and it notifies nobody.** `offer.rejected_by_admin` has
 * no entry in DD11's closed catalogue of sends, and the Hirer already reads the
 * outcome on `/sent-offers`, where story 6 shipped both a badge and a sentence
 * for the state. A mail here would be a fifteenth kind decided at Build time,
 * which is the judgment call that list exists to refuse.
 *
 * **`approvePhoto` and `rejectPhoto` arrived together with #18**, and the pair
 * is not a coincidence: DD6's steps 4 and 5 are two different irreversible acts
 * on the same object — one re-encodes it into the public prefix, the other
 * deletes it — so a queue that could do one and not the other would be a queue
 * an Admin cannot clear.
 *
 * **`declineSkill` is the one absence worth explaining**, since its pair is here.
 * Promotion is story 3's, because a request nobody can promote is a queue item
 * whose resolver is a later ticket — which is the shape that made this story
 * carry both its halves in the first place. Declining is the Admin section's own
 * ticket, where the row it acts on already has a place to be rendered.
 *
 * English identifiers under ADR-0012, and the spelling is the API contract's.
 */
export const ADMIN_ACTION_NAMES = [
  "revokeSessions",
  "promoteSkill",
  "deliverOffer",
  "rejectOffer",
  "approvePhoto",
  "rejectPhoto",
] as const;

export type AdminActionName = (typeof ADMIN_ACTION_NAMES)[number];
