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
 * itself"_ — eleven is the number the finished product has, and two is the number
 * that exists today. The other nine each need an entity a later story creates
 * (Offer, photo, Report, CapabilityProfile), so they arrive with their story: a
 * name here, a handler in the registry, and nothing else. The `CHECK` follows
 * from the name and the audit follows from the executor, which is the whole point
 * of the shape.
 *
 * **`declineSkill` is the one absence worth explaining**, since its pair is here.
 * Promotion is story 3's, because a request nobody can promote is a queue item
 * whose resolver is a later ticket — which is the shape that made this story
 * carry both its halves in the first place. Declining is the Admin section's own
 * ticket, where the row it acts on already has a place to be rendered.
 *
 * English identifiers under ADR-0012, and the spelling is the API contract's.
 */
export const ADMIN_ACTION_NAMES = ["revokeSessions", "promoteSkill"] as const;

export type AdminActionName = (typeof ADMIN_ACTION_NAMES)[number];
