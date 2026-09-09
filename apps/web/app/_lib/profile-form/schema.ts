/**
 * What `/publish` accepts, declared once and parsed twice (ADR-0014).
 *
 * **This is the shape half.** Lengths, presence, one letter, a known city, one
 * to six Skills, up to five history lines, the consent ticked. The *substance*
 * half — the contact-detail rejector, the phone normaliser, whether a Skill is
 * in the active vocabulary — lives in `@repo/domain/profiles` and runs on the
 * server only, because it is the rule and a rule enforced in a browser is not
 * enforced. What this module buys her is the round trip she does not have to
 * make for a typo she can already see.
 *
 * **This module imports nothing from `@repo/domain`, and that is load-bearing.**
 * It is reached from a Client Component, and even the pure subpaths sit in a
 * package whose other entries pull `pg` onto the client graph. The city ids are
 * therefore restated here, and `schema.test.ts` asserts they agree with the
 * domain's registry — the test may import the domain; the browser may not.
 *
 * **Every schema carries its own sentence, and the sentence comes from
 * `./messages`.** Nothing Zod authored is ever rendered (ADR-0014's second
 * rule), which is what lets these be handed to TanStack Form as validators.
 */

import { z } from "zod";
import {
  ABOUT_TOO_LONG,
  CITY_REQUIRED,
  CONSENT_REQUIRED,
  FIRST_NAME_REQUIRED,
  FIRST_NAME_TOO_LONG,
  FULL_NAME_REQUIRED,
  FULL_NAME_TOO_LONG,
  HEADLINE_REQUIRED,
  HEADLINE_TOO_LONG,
  LAST_INITIAL_ONE_LETTER,
  LAST_INITIAL_REQUIRED,
  PHONE_LOOKS_WRONG,
  PAGE_STALE,
  PHONE_REQUIRED,
  SKILL_NO_LONGER_LISTED,
  SKILL_REQUEST_REQUIRED,
  SKILL_REQUEST_TOO_LONG,
  SKILL_REQUIRED,
  SKILLS_TOO_MANY,
  WORK_HISTORY_LINE_TOO_LONG,
  WORK_HISTORY_TOO_MANY,
} from "./messages";

export const LIMITS = {
  fullName: 80,
  firstName: 40,
  headline: 120,
  about: 600,
  workHistoryLine: 120,
  workHistoryLines: 5,
  skills: 6,
  skillRequest: 80,
} as const;

/** Restated from `@repo/domain/policy`'s `CITY_IDS`; `schema.test.ts` pins the agreement. */
export const CITY_IDS = ["pereira", "dosquebradas", "santa_rosa_de_cabal"] as const;

export const fullNameField = z
  .string()
  .trim()
  .min(1, FULL_NAME_REQUIRED)
  .max(LIMITS.fullName, FULL_NAME_TOO_LONG);

export const firstNameField = z
  .string()
  .trim()
  .min(1, FIRST_NAME_REQUIRED)
  .max(LIMITS.firstName, FIRST_NAME_TOO_LONG);

/**
 * One letter, any script's, upper-cased the way `es-CO` upper-cases — so `ñ`
 * becomes `Ñ` and a card reads *Ana Ñ.* rather than *Ana ñ.*
 */
export const lastInitialField = z
  .string()
  .trim()
  .min(1, LAST_INITIAL_REQUIRED)
  .regex(/^\p{L}$/u, LAST_INITIAL_ONE_LETTER)
  .transform((letter) => letter.toLocaleUpperCase("es-CO"));

export const cityField = z.enum(CITY_IDS, { message: CITY_REQUIRED });

export const headlineField = z
  .string()
  .trim()
  .min(1, HEADLINE_REQUIRED)
  .max(LIMITS.headline, HEADLINE_TOO_LONG);

export const aboutField = z.string().trim().max(LIMITS.about, ABOUT_TOO_LONG);

/**
 * Shape only: digits, with the separators people type, and a leading `+` if
 * she wrote one. Whether it is a Colombian number is the domain's question,
 * answered on the server with the same sentence.
 */
export const phoneField = z
  .string()
  .trim()
  .min(1, PHONE_REQUIRED)
  .regex(/^\+?(?:[\s().-]*\d){7,}[\s().-]*$/, PHONE_LOOKS_WRONG);

/** Slugs are English identifiers; anything else in the array is not from the picker. */
export const skillSlugsField = z
  .array(z.string().regex(/^[a-z0-9-]+$/, SKILL_NO_LONGER_LISTED))
  .min(1, SKILL_REQUIRED)
  .max(LIMITS.skills, SKILLS_TOO_MANY);

export const workHistoryLineField = z
  .string()
  .trim()
  .max(LIMITS.workHistoryLine, WORK_HISTORY_LINE_TOO_LONG);

export const workHistoryField = z
  .array(workHistoryLineField)
  .max(LIMITS.workHistoryLines, WORK_HISTORY_TOO_MANY);

/** The *autorización*'s checkbox. `true` or refused; there is no third state. */
export const consentField = z.literal(true, { message: CONSENT_REQUIRED });

/** The same rule, silent about an empty field — for `onBlur`, as `/sign-in` does. */
export const optionalOnBlur = <T extends z.ZodType>(schema: T) => z.union([z.literal(""), schema]);

export const publishProfileFields = z.object({
  fullName: fullNameField,
  firstName: firstNameField,
  lastInitial: lastInitialField,
  city: cityField,
  headline: headlineField,
  about: aboutField,
  phone: phoneField,
  skillSlugs: skillSlugsField,
  workHistory: workHistoryField,
  consent: consentField,
});

export type PublishProfileInput = z.output<typeof publishProfileFields>;

/**
 * The same ten fields with **no rule applied** — the shape the action accepts
 * at its boundary, so that a refused submission can be handed back whole.
 *
 * The strict parse runs inside the action rather than as its `inputSchema`
 * because next-safe-action returns only `validationErrors` for a schema
 * refusal and never the input, and on the unhydrated path the page re-renders
 * from what the action returned: a refusal that carried errors and not values
 * would re-render an empty form under a sentence saying nothing was lost.
 */
export const publishProfileValues = z.object({
  fullName: z.string(),
  firstName: z.string(),
  lastInitial: z.string(),
  city: z.string(),
  headline: z.string(),
  about: z.string(),
  phone: z.string(),
  skillSlugs: z.array(z.string()),
  workHistory: z.array(z.string()),
  consent: z.boolean(),
});

export type PublishProfileValues = z.output<typeof publishProfileValues>;

function stringsOf(raw: FormData, name: string): string[] {
  return raw.getAll(name).map((value) => (typeof value === "string" ? value : ""));
}

function stringOf(raw: FormData, name: string): string {
  const value = raw.get(name);
  return typeof value === "string" ? value : "";
}

/**
 * The same fields, reached from either shape a caller can arrive in.
 *
 * next-safe-action does not convert `FormData`, so a `useActionState`-driven
 * submit hands the raw object over and this is what shapes it. Repeated names
 * become arrays — `skillSlugs` is every ticked checkbox and `workHistory` every
 * line — and the consent checkbox's `"true"` becomes the boolean the field
 * refuses anything but. A plain object passes straight through, so a direct
 * call and a test need not build a `FormData`.
 */
function fromFormData(raw: unknown): unknown {
  return raw instanceof FormData
    ? {
        fullName: stringOf(raw, "fullName"),
        firstName: stringOf(raw, "firstName"),
        lastInitial: stringOf(raw, "lastInitial"),
        city: stringOf(raw, "city"),
        headline: stringOf(raw, "headline"),
        about: stringOf(raw, "about"),
        phone: stringOf(raw, "phone"),
        skillSlugs: stringsOf(raw, "skillSlugs"),
        workHistory: stringsOf(raw, "workHistory"),
        consent: raw.get("consent") === "true",
      }
    : raw;
}

/** The strict parse over either shape: what the browser guards a submit with. */
export const publishProfileSchema = z.preprocess(fromFormData, publishProfileFields);

/** The lenient parse: what the action accepts, so a refusal can return the values. */
export const publishProfileValuesSchema = z.preprocess(fromFormData, publishProfileValues);

/**
 * What a Worker may ask for when the list does not hold her trade.
 *
 * **The ceiling on the length is here and the ceiling on the rate is NFR26's**,
 * and they answer different things: this one keeps a capability the length of a
 * capability, so an Admin promoting it is reading a phrase rather than a
 * paragraph, and eighty is the length of the longest entry the seed holds with
 * room to spare. What this schema deliberately does **not** check is whether the
 * text carries a phone number — that is `@repo/domain`'s rejector, it is the rule
 * rather than a typo, and a rule enforced in a browser is not enforced.
 *
 * `FormData` is accepted for the reason every other schema here accepts it:
 * next-safe-action converts neither shape, and the field arrives as one or the
 * other depending on how the action was dispatched.
 */
export const skillRequestField = z
  .string()
  .trim()
  .min(1, SKILL_REQUEST_REQUIRED)
  .max(LIMITS.skillRequest, SKILL_REQUEST_TOO_LONG);

export const skillRequestFields = z.object({ text: skillRequestField });

export const skillRequestSchema = z.preprocess(
  (raw) => (raw instanceof FormData ? { text: stringOf(raw, "text") } : raw),
  skillRequestFields,
);

export type SkillRequestValues = z.output<typeof skillRequestFields>;

/**
 * **Editing: the same nine fields, `consent` removed.**
 *
 * `.omit` rather than a second `z.object`, so the two can only ever differ by
 * the field named here. The API contract says the edit action is
 * "`publishProfile`'s field set minus `consentVersion`", and this is that
 * sentence in the type system — a field added to publishing appears here
 * without anybody remembering to add it, which is the failure a copied object
 * literal would have had.
 *
 * An edit collects no consent because it is a change to what her profile says
 * rather than a fresh collection of her data.
 */
export const updateProfileFields = publishProfileFields.omit({ consent: true });

/** The lenient half, the same way round: her values survive a refusal. */
export const updateProfileValues = publishProfileValues.omit({ consent: true });

export type UpdateProfileValues = z.output<typeof updateProfileValues>;

/** The strict parse the edit form's browser-side guard runs. */
export const updateProfileSchema = z.preprocess(fromFormData, updateProfileFields);

/** The lenient parse the edit action accepts. */
export const updateProfileValuesSchema = z.preprocess(fromFormData, updateProfileValues);

/**
 * **What a refusal echoes back, from either form.**
 *
 * The nine fields both forms render, plus publishing's consent where the form
 * that was refused had one — `consent` optional rather than required, because
 * the edit form has none and a reader that insisted on it returned *nothing*
 * for every refused edit. On the unhydrated path that is every value she typed,
 * lost, under a sentence saying nothing was lost. Optional rather than omitted
 * because a publish refusal really does carry it, and a reader shared by two
 * surfaces should describe both rather than the narrower one.
 *
 * Nothing re-ticks the consent box from this: consent is an act she takes, not
 * a value the form displays back to her.
 */
export const refusedProfileValues = publishProfileValues.partial({ consent: true });

export type RefusedProfileValues = z.output<typeof refusedProfileValues>;

/**
 * The two versions the form *displayed*, travelling as one bound argument
 * rather than as hidden inputs (ADR-0015, `authorization.tsx`). The action
 * validates them on arrival and the domain refuses a stale pair.
 */
export const consentVersionsArg = z.object({
  notice: z.string().min(1, PAGE_STALE),
  authorization: z.string().min(1, PAGE_STALE),
});

/**
 * The quarantine key her browser was given, as a **bound argument** rather than
 * a hidden input (ADR-0015).
 *
 * **It travels with the submit and nobody types it**, so React encodes it into
 * the action reference, it survives without JavaScript (as `null` — see below),
 * and the form's markup carries no mirror of it. A hidden `<input>` holding a
 * key would be a piece of client state mirrored into the DOM, which is the exact
 * shape ADR-0015 exists to replace.
 *
 * **`null` is the ordinary case, not an edge.** She picked no photo, or the
 * upload lost the race with her submit, or JavaScript never ran — all three are
 * a profile published without a photo, which is the design rather than a
 * failure.
 *
 * **The shape is checked here and again in the domain**, and the second check is
 * the one that matters: this value round-trips through the browser, so by the
 * time it comes back it is caller-controlled. `attachPhoto` refuses anything
 * that is not a key `@repo/storage` minted, which is what stops one profile's
 * row being pointed at another profile's object.
 */
export const photoKeyArg = z
  .string()
  .regex(/^quarantine\/[A-Za-z0-9_-]{21}$/)
  .nullable();

/**
 * What the browser tells `createPhotoUpload` about the bytes it is about to
 * send.
 *
 * **Both values are signed into the presigned URL and neither is trusted.** The
 * length becomes a `Content-Length` condition on the signature — which is what
 * makes DD6's ceiling a property of the bucket rather than of our code — and the
 * type is checked against a closed set and then named in the signature's
 * `signableHeaders`, so the PUT that arrives has to carry the type that was
 * declared. Neither decides anything: the server-side re-encode reads the format
 * out of the bytes, because this string is a header the browser composed.
 *
 * **The type is signed only because `presignUpload` asks for it explicitly.**
 * Naming `ContentType` on the command does not sign it — the presigner drops
 * `content-type` into `unsignableHeaders` unconditionally — so the sentence
 * above is true of the length by default and true of the type only through
 * `@repo/storage`.
 *
 * No messages, because no sentence from here reaches a person: the browser is
 * what fills this in, and a payload that fails it is not a form somebody typed.
 *
 * **`contentType` is a bounded string here rather than the allowlist itself**,
 * and that is a decision rather than an omission. The closed set lives beside
 * the code that signs with it, because the set and the signature have to agree
 * and a second copy at the boundary is the copy that drifts. What this stops is
 * an unbounded string reaching a signer; deciding which types are photographs
 * is `@repo/storage`'s.
 */
export const photoUploadSchema = z.object({
  byteLength: z.number().int().positive(),
  contentType: z.string().min(1).max(100),
});

export type PhotoUploadValues = z.output<typeof photoUploadSchema>;
