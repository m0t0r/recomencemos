/**
 * The header the Google door declares her shared-device answer on.
 *
 * **A leaf module with no imports, on purpose.** The name has to exist on the
 * browser side, and it cannot be imported from `@repo/domain/auth-handler`:
 * that pulls `#connection` — and `pg` — onto the client graph, which happened
 * once on this surface and which `server-only` refused at the door. Keeping it
 * here, importing nothing, is also what lets `shared-device-header.test.ts` pin
 * the two spellings together without dragging a Server Action's whole import
 * chain into a Node-environment test.
 *
 * `/sign-in/social`'s request body is a closed schema that strips unknown keys,
 * so a header is the one channel this answer survives on. It is **not** a
 * security boundary and does not need to be: the only thing a forged value
 * changes is how long her own session lasts, which she can already change by not
 * ticking the box.
 */
export const SHARED_DEVICE_HEADER = "x-recomencemos-shared-device";
