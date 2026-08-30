/**
 * What one session looks like by the time it reaches a component.
 *
 * **Every field is a finished string, and that is deliberate.** Two reasons, and
 * the second is the one that would otherwise be found the hard way:
 *
 * - **The clock is read once, on the server, at the dynamic boundary.** With
 *   Cache Components on, reading the current time inside a component that
 *   prerenders fails the build with `blocking-prerender-current-time`. Formatting
 *   here means one `new Date()` for the whole page rather than one per row.
 * - **A `Date` rendered on both sides disagrees with itself.** The server is UTC
 *   and the reader is in Risaralda; a component formatting a `Date` after
 *   hydration would produce a different sentence from the one the server sent,
 *   which React reports as a hydration mismatch and a person reads as the page
 *   flickering.
 *
 * So `Date` never crosses to a component, and the row has no opinion about
 * timezones, locales or `Intl`.
 */

import type { AccountSession } from "@repo/domain/auth-handler";
import { readDevice } from "./device";
import { expiresLabel, startedLabel } from "./format";
import { deviceLabel } from "./messages";

export interface SessionView {
  readonly id: string;
  /** The session reading this page. It has no close control of its own. */
  readonly current: boolean;
  /** `Chrome en Android`, or the honest sentence for a browser we cannot read. */
  readonly device: string;
  /** `hoy` · `ayer` · `hace 6 días` · `el 8 de septiembre` */
  readonly started: string;
  /** `se cierra hoy a las 8:40 p. m.` · `se cierra el 27 de septiembre` */
  readonly expires: string;
}

export function toSessionViews(
  sessions: readonly AccountSession[],
  now: Date,
): readonly SessionView[] {
  return sessions.map((session) => {
    const { browser, platform } = readDevice(session.userAgent);

    return {
      id: session.id,
      current: session.current,
      device: deviceLabel(browser, platform),
      started: startedLabel(session.createdAt, now),
      expires: expiresLabel(session.expiresAt, now),
    };
  });
}
