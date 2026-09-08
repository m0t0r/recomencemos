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
 * itself"_ — eleven is the number the finished product has, and five is the
 * number that exists today. Four of the remaining six wait on an entity no story
 * has created yet: `resolveReport`, `unfreezeHirer` and `banHirer` all need the
 * Report, and `takeDownProfile` needs the takedown. They arrive with their story
 * — a name here, a handler in the registry, and nothing else — because the
 * `CHECK` follows from the name and the audit follows from the executor, which is
 * the whole point of the shape. The last two, `rejectOffer` and `declineSkill`,
 * need no entity at all and are the two absences explained below.
 *
 * **`deliverOffer` is story 6's, and it is the one act with a deadline on it.**
 * NFR7 gives every Offer a 24-hour review band, so the queue's first section is
 * the one this action empties. Its pair `rejectOffer` is not here for
 * `declineSkill`'s reason: refusing an Offer belongs with the Admin section that
 * renders the row it refuses, and delivering one had to arrive with the story
 * that writes the Offers — an Offer nobody can deliver is an Offer that only
 * accumulates.
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
  "approvePhoto",
  "rejectPhoto",
] as const;

export type AdminActionName = (typeof ADMIN_ACTION_NAMES)[number];
