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
 * The two versions the form *displayed*, travelling as one bound argument
 * rather than as hidden inputs (ADR-0015, `authorization.tsx`). The action
 * validates them on arrival and the domain refuses a stale pair.
 */
export const consentVersionsArg = z.object({
  notice: z.string().min(1, PAGE_STALE),
  authorization: z.string().min(1, PAGE_STALE),
});
