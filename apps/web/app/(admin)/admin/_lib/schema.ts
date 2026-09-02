/**
 * The boundary parse for the queue's actions.
 *
 * ADR-0014: one schema, parsed twice — here for the message a person reads, and
 * again on the server where it actually decides. The Admin's actions are the ones
 * where the second parse matters most, since the compiled POST endpoint is
 * reachable without ever rendering the form.
 */

import { z } from "zod";
import {
  ADDRESS_LOOKS_WRONG,
  PROMOTE_CUOC_SHAPE,
  PROMOTE_LABEL_REQUIRED,
  PROMOTE_LABEL_TOO_LONG,
  PROMOTE_SLUG_REQUIRED,
  PROMOTE_SLUG_SHAPE,
} from "./messages";

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

/**
 * `promoteSkill` takes the request it resolves and the two names the entry will
 * carry.
 *
 * **The Admin authors both names, and the shapes are enforced here** because
 * they are the vocabulary's own rules rather than this form's: an identifier
 * travels in a query parameter and stays English and ASCII (ADR-0012), and a
 * label is read on a form and is therefore the length of a label. Her request is
 * the evidence for the entry and is never copied into either field by the
 * machine — a slug derived from Spanish text would be a Spanish identifier, and a
 * label taken verbatim would skip the translation the vocabulary exists to do.
 *
 * **`cuocCode` is optional and the column is nullable.** An entry that arrived
 * through a request may answer to no CUOC *Ocupación*, which is frequently why it
 * had to be requested; an empty field means exactly that.
 *
 * The id is digits rather than a number: it is a `BIGINT` key, and parsing it
 * into a JavaScript `number` is lossy past 2^53 for no benefit — nothing here
 * does arithmetic on it.
 */
export const promoteSkillFields = z.object({
  requestId: z.string().regex(/^\d+$/),
  slug: z
    .string()
    .trim()
    .min(1, PROMOTE_SLUG_REQUIRED)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, PROMOTE_SLUG_SHAPE),
  labelEs: z.string().trim().min(1, PROMOTE_LABEL_REQUIRED).max(80, PROMOTE_LABEL_TOO_LONG),
  /**
   * `""` becomes absent rather than a refusal: an empty optional field is how the
   * form says "no code", and asking Zod to distinguish the two would make the
   * absence a validation problem.
   */
  cuocCode: z
    .string()
    .trim()
    .regex(/^\d{5}$/, PROMOTE_CUOC_SHAPE)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export const promoteSkillSchema = z.preprocess(
  (raw) =>
    raw instanceof FormData
      ? {
          requestId: field(raw, "requestId"),
          slug: field(raw, "slug"),
          labelEs: field(raw, "labelEs"),
          cuocCode: field(raw, "cuocCode"),
        }
      : raw,
  promoteSkillFields,
);

export type PromoteSkillInput = z.output<typeof promoteSkillFields>;

function field(raw: FormData, name: string): string {
  const value = raw.get(name);
  return typeof value === "string" ? value : "";
}
