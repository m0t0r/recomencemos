/**
 * The publish refusal's `AppError.code` on the wire. Named here rather than in
 * `actions.ts`, because a `"use server"` module may export only async functions
 * and the client-side feedback rule has to read the same spelling.
 */
export const PUBLISH_REFUSED_CODE = "publish_refused";
