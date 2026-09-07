import "server-only";

/**
 * NFR26's ceilings, charged from a **page** rather than from a Server Action.
 *
 * **The sibling of `rateLimit` in `lib/safe-action.ts`, and it exists because
 * that one cannot serve a page.** `rateLimit` is a `useValidated` middleware: it
 * runs after an action's boundary parse and returns a client envelope. A page
 * has no parsed input and no envelope — it renders a state — so the shape it
 * needs is a function that answers "may this read proceed, and if not what do I
 * tell her".
 *
 * **What the two must not differ about is the log line.** CLAUDE.md's rule is
 * "thrown is reported; returned is logged": a ceiling refusal is *returned*, so
 * it costs one `warn` line and no Sentry event. Written inline in a page that
 * line is exactly what gets left out — it was, and `/code-review` found it — and
 * an unlogged ceiling is a ceiling that turns enumeration into silence rather
 * than into the signal DD7 says it is. So the charge and the line live together
 * here, and a caller cannot take one without the other.
 *
 * **Sequential, and it stops at the first refusal**, which is what makes the
 * message she reads the one that is actually binding: charging the day's ceiling
 * after the hour's has already refused would spend an allowance she never got to
 * use.
 */

import type { CeilingedAction, CeilingPrincipal } from "@repo/domain/rate-limit";
import { ceilings } from "@repo/domain/rate-limit";
import { logRequestError } from "@repo/observability/log-request-error";

/** What a surface needs in order to say a ceiling refused (NFR26's third half). */
export interface CeilingRefusal {
  /** The ceiling's own sentence, in her terms. The only string that crosses. */
  readonly userMessage: string;
  /** Seconds until the window resets. */
  readonly retryAfter: number;
}

/**
 * Charge every action against every principal, and answer with the first
 * refusal — or `undefined`, meaning the read may proceed.
 *
 * The `AppError` the ceiling carries is the operator half and is logged here;
 * only `userMessage` is handed back, because it is the only string permitted to
 * reach a browser.
 */
export async function chargeCeilings(
  principals: readonly CeilingPrincipal[],
  actions: readonly CeilingedAction[],
): Promise<CeilingRefusal | undefined> {
  for (const action of actions) {
    for (const principal of principals) {
      // Sequential on purpose — see above; a refusal must stop the charges.
      // oxlint-disable-next-line no-await-in-loop
      const outcome = await ceilings.charge(principal, action);
      if (outcome.allowed) continue;

      // Returned, not thrown: one `warn` line, no Sentry event.
      logRequestError(outcome.error, { level: "warn" });

      return { userMessage: outcome.error.userMessage, retryAfter: outcome.retryAfter };
    }
  }

  return undefined;
}
