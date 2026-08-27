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
 * **No `export const dynamic`, and its absence is the correct configuration.**
 * Cache Components makes data dynamic by default and you opt *into* caching with
 * `use cache` — so a Route Handler is already dynamic, and the Next 15 segment
 * knob is not merely redundant here but refused: _"Route segment config
 * 'dynamic' is not compatible with `nextConfig.cacheComponents`."_ Nothing in
 * this route may ever be cached — `get-session` answers per session and
 * `magic-link/verify` consumes a single-use token — and nothing has to be said
 * for that to hold.
 */

export async function GET(request: Request): Promise<Response> {
  return auth().handler(request);
}

export async function POST(request: Request): Promise<Response> {
  return auth().handler(request);
}
