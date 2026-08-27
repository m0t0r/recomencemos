// @vitest-environment node
//
// **Node, not happy-dom**, and the reason is the thing being tested. This file
// imports `@repo/domain`, which is server-only and whose `assertServerOnly`
// backstop throws the moment `globalThis.window` exists — mechanism 3 doing
// exactly its job. The rest of this app's suite is happy-dom because it renders
// components; this one asserts a constant on the server side of a boundary.

/**
 * One spelling of the shared-device header, pinned across the boundary that
 * stops it being a shared constant.
 *
 * The Google door declares her answer as a request header, so the name exists on
 * both sides: `@repo/domain` reads it in a `hooks.before` middleware, and the
 * Client Component sets it. It cannot simply be imported from the domain
 * package, because `@repo/domain/auth-handler` pulls `#connection` — and `pg` —
 * onto the client graph. That is not hypothetical: it happened once on this
 * surface, and `server-only` refused it at the door.
 *
 * So the browser keeps its own literal and this test makes the duplication safe.
 * A rename on either side is red here rather than a shared-device checkbox that
 * silently stops working — which would be invisible, because the failure is a
 * 30-day session where an 8-hour one was asked for.
 *
 * This file imports the domain package, which is fine: it is a test, not a
 * client module.
 */

import { SHARED_DEVICE_HEADER } from "@repo/domain/auth-handler";
import { SHARED_DEVICE_HEADER as CLIENT_HEADER } from "./shared-device-header";

it("is spelled the same in the browser and in the domain", () => {
  expect(CLIENT_HEADER).toBe(SHARED_DEVICE_HEADER);
});
