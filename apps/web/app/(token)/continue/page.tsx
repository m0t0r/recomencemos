/**
 * `/continue` — where a spent Admin link lands, and the only screen between a
 * mailbox and a session.
 *
 * Shaped at `.impeccable/briefs/admin-door.md`. **Two things in that brief were
 * overtaken by the door that shipped, and both are recorded here rather than
 * quietly followed or quietly ignored:**
 *
 * - It targets `app/(admin)/admin/continue/page.tsx`. The route is `/continue`,
 *   because a `GET` verify URL is consumed by link scanners, WhatsApp previews
 *   and Outlook Safe Links — so those clients receive this redirect, and
 *   `/admin/...` in a `Location` would make a granted address distinguishable in
 *   a gateway's logs. `SECOND_FACTOR_ROUTE` in `@repo/domain` is the authority
 *   and carries the full argument.
 * - It therefore inherits no `noindex` from `/admin/:path*`. This page sets
 *   `metadata.robots` for itself, the way `/sign-in` does — and the stronger
 *   half is below: a request with no live challenge is a **404**, so there is
 *   nothing here for a crawler to reach in the first place.
 *
 * **It sits in `(token)` rather than `(admin)`.** That group renders
 * `AdminHeader`, which answers "am I signed in, as whom, how do I leave" — three
 * questions with no true answer on a page where no session exists yet — and
 * links a wordmark to the queue, which would tell whoever holds a stolen link
 * that a queue is there. `(token)` has no layout of its own, so what wraps this
 * is the root document and nothing else.
 */

import { requireAdminSession } from "@repo/domain/admin";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { CodeForm } from "./_components/code-form";
import { CONTINUE_PAGE_TITLE } from "./_lib/messages";

export const metadata: Metadata = {
  title: CONTINUE_PAGE_TITLE,
  robots: { index: false, follow: false },
};

/**
 * **`[block]` from Cache Components' own menu**, for the reason the enrolment
 * screen next door blocks: this route's two answers are this page and a 404, and
 * a streamed shell is a **200** already on the wire by the time the challenge has
 * been judged. `[cache]` would be worse than wrong — the answer is a property of
 * one browser's cookie.
 *
 * What blocking costs is a static shell, and there is no shell worth having: one
 * field and one button, for somebody whose hands already know what to do.
 */
export const instant = false;

export default async function ContinuePage() {
  const request = await headers();

  /**
   * **Somebody who is already through this door is sent past it**, which is the
   * spec's own row for this surface and not a courtesy: an Admin who bookmarked
   * the page, or came back to it on the browser's history, has nothing to type
   * and no second factor to present, so a code field would be a dead end and a
   * 404 would be a lie about a route they can reach.
   *
   * **It is not an oracle**, which is the thing to check before adding any
   * branch to this page. The answer differs only for a caller already holding an
   * Admin session — who therefore already knows they hold one — and every other
   * caller, challenge or no challenge, gets exactly what they got before.
   *
   * `requireAdminSession` and not `isAdmin`: an Admin session is one that
   * presented an emailed link *and* a code, and the grant on its own is the
   * magic-link hole that gate exists to close.
   */
  if (requireAdminSession(await auth().getSession(request))) redirect("/admin");

  /**
   * **Absent, cleared, malformed, forged, expired and signed with another key
   * are one answer, and it is `notFound()`** — no message, no resend offer, no
   * route onward. A legible refusal here is an oracle for which challenges
   * existed, and somebody who legitimately needs another link already knows
   * where to ask for one.
   *
   * The boolean is all that crosses. `@repo/domain` reads the cookie with the
   * key that signed it and publishes nothing else — not the Account, not the
   * expiry — because a page that had either would be a page that could render
   * one by accident.
   */
  if (!auth().hasSignInChallenge(request)) notFound();

  return <CodeForm />;
}
