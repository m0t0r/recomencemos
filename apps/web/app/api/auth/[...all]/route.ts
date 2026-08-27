/**
 * Better Auth's own endpoints — `/api/auth/*`.
 *
 * **This is a second door, and NFR26 does not reach it.** A ceiling on the
 * `requestMagicLink` Server Action does nothing for a client posting straight to
 * `/api/auth/sign-in/magic-link`, which is why Better Auth's own limiter is
 * configured explicitly and pointed at the database rather than left on its
 * in-memory default (DD5, `#auth/config`).
 *
 * The binding of one handler to `GET` and `POST` is Next's shape and stays in
 * Next — `@repo/domain` hands over a `(Request) => Promise<Response>` and takes
 * no dependency on the framework.
 */

import { auth } from "../../../../lib/auth";

/**
 * Every response here depends on the request's cookies and none of it may be
 * cached: `GET /api/auth/get-session` answers per session, and
 * `GET /api/auth/magic-link/verify` consumes a single-use token. Cache
 * Components would otherwise want this route's reads inside a `use cache`
 * scope, which is the one thing they must never be.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return auth().handler(request);
}

export async function POST(request: Request): Promise<Response> {
  return auth().handler(request);
}
