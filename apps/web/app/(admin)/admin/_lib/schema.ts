/**
 * The boundary parse for the queue's actions.
 *
 * ADR-0014: one schema, parsed twice — here for the message a person reads, and
 * again on the server where it actually decides. The Admin's actions are the ones
 * where the second parse matters most, since the compiled POST endpoint is
 * reachable without ever rendering the form.
 */

import { z } from "zod";
import { ADDRESS_LOOKS_WRONG } from "./messages";

/**
 * `revokeSessions` takes an address and the audit stores an id.
 *
 * **An address in and an id out is the whole shape**, and it is not an
 * inconsistency: an Admin has an address in front of them — it is what a Report or
 * an incident report carries — and NFR18 permits the audit row to hold an id and
 * nothing else. `@repo/domain`'s handler resolves one to the other, and the
 * address goes no further than that resolution.
 *
 * **Not `.email()`'s default message.** Zod's is English, and ADR-0012 puts the
 * Spanish in the surface. It is deliberately not a *precise* message either: the
 * one person reading it knows what an address looks like, and telling them which
 * of Zod's rules failed would be a form explaining itself to its author.
 */
export const revokeSessionsFields = z.object({
  email: z.string().trim().min(1, ADDRESS_LOOKS_WRONG).email(ADDRESS_LOOKS_WRONG),
});

/**
 * `FormData` or a plain object, because next-safe-action converts neither —
 * verified against the installed package on #12, and the reason `/sign-in` carries
 * the same four lines rather than a `zod-form-data` dependency.
 */
export const revokeSessionsSchema = z.preprocess(
  (raw) =>
    raw instanceof FormData
      ? { email: typeof raw.get("email") === "string" ? raw.get("email") : "" }
      : raw,
  revokeSessionsFields,
);

export type RevokeSessionsInput = z.output<typeof revokeSessionsFields>;
