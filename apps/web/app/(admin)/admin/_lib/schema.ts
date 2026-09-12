/**
 * The boundary parse for the queue's actions.
 *
 * ADR-0014: one schema, parsed twice — here for the message a person reads, and
 * again on the server where it actually decides. The Admin's actions are the ones
 * where the second parse matters most, since the compiled POST endpoint is
 * reachable without ever rendering the form.
 */

import { SKILL_GROUP_IDS } from "@repo/domain/policy";
import { z } from "zod";
import {
  ADDRESS_LOOKS_WRONG,
  PROMOTE_CUOC_SHAPE,
  PROMOTE_GROUP_REQUIRED,
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
 * The request the promotion resolves, as a **bound argument** rather than a
 * hidden input (ADR-0015): it travels with a submit and is not typed into it, so
 * React encodes it into the action reference itself, it is validated on arrival,
 * and the row's markup carries no mirror of it.
 *
 * Digits rather than a number: it is a `BIGINT` key, parsing it into a
 * JavaScript `number` is lossy past 2^53, and nothing does arithmetic on it. No
 * message, because no person can provoke this — the id comes from the row, and a
 * forged one meets the refusals the action already answers.
 */
export const promoteSkillRequestArg = z.string().regex(/^\d+$/);

/**
 * The Offer a decision acts on, as a **bound argument** for the reason above it.
 *
 * **One parse for both decisions**, because delivering and refusing name their
 * target the same way and a second copy is a second place for the shape to drift.
 *
 * A UUID rather than digits, because DD2 makes `Offer.id` the one UUIDv7 in this
 * schema — `/offers/[id]` puts it in a URL, and a `BIGINT` there would publish
 * the platform's total Offer count. The pattern is version-agnostic: what this
 * refuses is a string that is not a UUID at all, and which version it carries is
 * the minter's business rather than this parse's.
 *
 * No message, because no person can provoke this — the id comes from the row,
 * and a forged one meets the refusals the domain already answers.
 */
export const offerIdArg = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

/** The label is read on the publishing form, so it is the length of a label. */
export const PROMOTE_LABEL_MAX = 80;

/**
 * The two names the entry will carry, and the code it may carry.
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
 */
export const promoteSkillFields = z.object({
  slug: z
    .string()
    .trim()
    .min(1, PROMOTE_SLUG_REQUIRED)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, PROMOTE_SLUG_SHAPE),
  labelEs: z
    .string()
    .trim()
    .min(1, PROMOTE_LABEL_REQUIRED)
    .max(PROMOTE_LABEL_MAX, PROMOTE_LABEL_TOO_LONG),
  /**
   * **Required, and one of the closed list** (ADR-0021): an entry with no group is
   * one the Hirer's index cannot reach. The form offers only the thirteen, so a
   * value outside them is a forged post rather than a slip, and it gets the same
   * sentence an empty choice does.
   */
  group: z.enum(SKILL_GROUP_IDS, { message: PROMOTE_GROUP_REQUIRED }),
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
          slug: field(raw, "slug"),
          labelEs: field(raw, "labelEs"),
          group: field(raw, "group"),
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

/**
 * The profile whose photo is being decided, as a **bound argument** rather than
 * a hidden input (ADR-0015): it travels with a submit and nobody types it, so
 * React encodes it into the action reference itself and this validates it on
 * arrival.
 *
 * Digits rather than a number, for `promoteSkillRequestArg`'s reason: it is a
 * `BIGINT` key, parsing it into a JavaScript `number` is lossy past 2^53, and
 * nothing does arithmetic on it. No message, because no person can provoke this
 * — the id comes from the row, and a forged one meets the refusals the action
 * already answers.
 *
 * **The length bound is not cosmetic.** Unbounded, `^\d+$` accepts a
 * million-digit string, and `readPendingKey` calls `BigInt(profileId)` *outside*
 * the transaction — so a forged bound argument buys quadratic parsing on the
 * 1 GB machine and then a thrown range error that reaches `handleServerError`
 * and spends a Sentry event. An Admin is trusted, which is why this is a bound
 * rather than a finding; 20 digits is past every id this table can issue and
 * far short of anything worth parsing.
 */
export const photoProfileArg = z.string().regex(/^\d+$/).max(20);

/**
 * The quarantine key the card was rendered with, as a **second bound argument**
 * on both photo decisions.
 *
 * **It binds the decision to the photo, where the profile id binds it only to
 * the row.** The queue renders one object and the approval reads it again, so a
 * decision naming a row applies to whatever that row points at by the time it
 * commits. It is not new information on the page: the signed review URL in the
 * same render is built from this key.
 *
 * **What actually bounds this value is downstream and is an equality**, not this
 * pattern. It never becomes part of a request; both `@repo/domain` checks
 * compare it against the key the row holds, which is one this repository minted
 * — so a string that is not a key of ours fails by not matching. This parse is
 * here to refuse such a string earlier and more cheaply, which is the same
 * division `offerIdArg` draws, and it spells the shape rather than importing
 * `@repo/storage`'s predicate because that subpath is server-only and this
 * module is one ADR-0014 means to be parsed on both sides.
 *
 * **Whole-match rather than `.regex()`, and the reason is `key-shapes.ts`'s.**
 * `$` matches *before* a trailing newline in this dialect, so `.regex()` — which
 * is a bare `.test()` — accepts `"quarantine/<21>\n"`. There is no `\z` here;
 * comparing the whole match against the whole input is the equivalent that
 * exists, and it is why the predicate that owns this shape is not a `.test()`
 * either.
 *
 * No message, because no person can provoke this — the key comes from the row,
 * and a forged one meets the refusals the domain already answers.
 */
const QUARANTINE_KEY_ARG = /^quarantine\/[A-Za-z0-9_-]{21}$/;

export const photoKeyArg = z.string().refine((key) => QUARANTINE_KEY_ARG.exec(key)?.[0] === key);

/**
 * **The payload of an action that has none.**
 *
 * All four queue decisions — both photo ones and both Offer ones — carry their
 * target as a bound argument and their verb as which button was pressed, so
 * there is nothing typed into any of them. The Offer pair reached this from the
 * other direction, through a `z.object({})` of its own that worked and was a
 * second spelling of one idea; one is enough. `z.void()`
 * was the first spelling and it is wrong: a `<form action={…}>` dispatch hands
 * next-safe-action `{}` rather than `undefined`, so every submission failed the
 * boundary parse — silently, because the row rendered `serverError` and a
 * validation failure is not one. Driven against the running server, that was an
 * approve button that did nothing at all and logged nothing.
 *
 * This accepts whatever arrives and yields `undefined`, which is what the action
 * body then sees. It is not a hole: nothing reads the payload, and the value the
 * action acts on is validated by `photoProfileArg` above.
 */
export const noPayloadSchema = z.preprocess(() => undefined, z.undefined());
