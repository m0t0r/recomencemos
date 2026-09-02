/**
 * Where a Worker's request for a missing Skill is in its life, as the registry
 * the `CHECK` on `skill_request.state` is generated from (DD2) — beside the
 * profile's own states, where every other closed set in this package lives.
 *
 * **A request is resolved, never deleted.** `promoted` and `declined` are both
 * terminal and both keep the row, because the row is what stops the same request
 * being resolved twice and what an `AdminAction` names as its target. A `DELETE`
 * would leave an audit row pointing at nothing.
 *
 * `declined` has no writer yet — that is the other half of the Admin's section,
 * and it is in the constraint from the first migration because widening an
 * enum-shaped column later is a constraint change nobody should have to pay for
 * a value this design already knows about.
 */
export const SKILL_REQUEST_STATES = ["pending", "promoted", "declined"] as const;
export type SkillRequestState = (typeof SKILL_REQUEST_STATES)[number];
