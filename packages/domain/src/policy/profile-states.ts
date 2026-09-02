/**
 * The two enum-shaped columns on `capability_profile`, as registries the
 * `CHECK` constraints are generated from (DD2) — beside the city registry,
 * where every other closed set in this package lives.
 */

/** Where the photo is in its life. `absent` is a profile that never attached one. */
export const PHOTO_STATES = ["absent", "pending", "approved", "rejected"] as const;
export type PhotoState = (typeof PHOTO_STATES)[number];

/** `deleted` is deliberately not here — moderation takedown and habeas data never share a mechanism (DD8). */
export const PROFILE_STATES = ["published", "taken_down"] as const;
export type ProfileState = (typeof PROFILE_STATES)[number];
