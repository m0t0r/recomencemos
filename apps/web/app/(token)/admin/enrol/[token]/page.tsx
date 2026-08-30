/**
 * `/admin/enrol/[token]` — the page `pnpm admin:enrol`'s setup link opens.
 *
 * **It takes no input at all.** The six digits that prove the authenticator
 * works are typed back into the terminal, which verifies them over the direct
 * connection and only then sets the grant. So this route renders three
 * credentials and grants nothing: a link opened and abandoned leaves no Admin
 * behind.
 *
 * **It is one of two routes under `/admin` that does not call the gate**, and it
 * is an exemption by omission rather than by rule — `requireAdminPage` is a call,
 * and this page does not make it. There is no allowlist anywhere, because a
 * carve-out is a second place the boundary is described and the first thing a
 * later route does is fall on the wrong side of it. What stands in for the gate
 * here is the token: unguessable, single-purpose, and short-lived.
 *
 * **`noindex`** — `/admin/:path*` is on NFR8's list, so the `X-Robots-Tag` header
 * arrives from `next.config.ts` with no new row, and this carries the `<meta>`
 * half because NFR8 wants both.
 */

import { enrolments } from "@repo/domain/admin-enrolment";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Enrolment } from "./_components/enrolment";
import { ENROL_PAGE_TITLE } from "./_lib/messages";

export const metadata: Metadata = {
  title: ENROL_PAGE_TITLE,
  robots: { index: false, follow: false },
};

/**
 * **`[block]` from Cache Components' own menu**, for the reason `/admin` uses it
 * one level up and for one of this page's own.
 *
 * `[stream]` would let a shell paint before the token has been judged — and that
 * shell is a **200**, already on the wire, for a route whose only two answers are
 * this page and a 404. `[cache]` would be a serious bug: every value on this page
 * is minted per token, and a cached render serves one person's TOTP secret to the
 * next.
 *
 * What blocking costs is a static shell, and there is no shell worth having here:
 * there is nothing on this page worth painting before the values arrive, and a
 * half-rendered enrolment screen is worse than a slower whole one.
 */
export const instant = false;

export default async function AdminEnrolPage({
  params,
}: {
  readonly params: Promise<{ readonly token: string }>;
}) {
  const { token } = await params;

  /**
   * **Straight to the domain, with no `lib/` wrapper**, unlike `requireAdminPage`
   * next door. That one exists because the gate has a framework half — reading
   * headers, choosing the shape of a 403. This has none: it is one read whose
   * authorization *is* the token, and a wrapper would be a file that forwards.
   */
  const secrets = await enrolments.read(token);

  /**
   * **Expired, spent, unknown and malformed are one answer**, and it is a 404
   * with no message, no resend offer and no route onward. A legible refusal here
   * would be an oracle for which tokens existed — and the domain read does not
   * distinguish the four either, so there is nothing richer to leak even if this
   * page wanted to.
   */
  if (!secrets) notFound();

  return <Enrolment {...secrets} />;
}
