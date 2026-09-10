/**
 * What the Offer form accepts, declared once and parsed twice (ADR-0014).
 *
 * **This is the shape half.** Presence and lengths, and — on his first Offer —
 * a name, a number and the *autorización* ticked. The *substance* half is
 * `@repo/domain/offers`': the contact-detail rejector, the phone normaliser,
 * whether he is Blocked, whether his Account may send at all. Those are the
 * rules, and a rule enforced in a browser is not enforced. What this module buys
 * him is the round trip he does not have to make for a typo he can already see.
 *
 * **This module imports nothing from `@repo/domain`, and that is load-bearing.**
 * It is reached from a Client Component, and even the pure subpaths sit in a
 * package whose other entries pull `pg` onto the client graph.
 *
 * **Every schema carries its own sentence, and the sentence comes from
 * `./offer-messages`.** Nothing Zod authored is ever rendered (ADR-0014's second
 * rule).
 *
 * **The identity fields are optional in the shape and conditional in
 * substance.** Whether they are required is a fact about a Consent row, which
 * only the server can read — so the shape admits their absence and
 * `@repo/domain/offers` refuses a first Offer that arrives without them. A
 * browser told "these are required" by a page that also decides whether to
 * render them would be deciding the same thing twice, in the place that cannot
 * be trusted with it.
 */

import { z } from "zod";
import {
  HIRER_NAME_REQUIRED,
  HIRER_NAME_TOO_LONG,
  HIRER_PHONE_LOOKS_WRONG,
  OFFER_CONSENT_REQUIRED,
  OFFER_PAGE_STALE,
  PAY_REQUIRED,
  PAY_TOO_LONG,
  WHEN_REQUIRED,
  WHEN_TOO_LONG,
  WORK_TOO_LONG,
  WORK_TOO_SHORT,
} from "./offer-messages";

/**
 * The bounds, as one object the fields and the `maxLength` attributes read.
 *
 * `workDescription`'s floor is twenty characters and it is the only floor here
 * above one: the story is that an Offer *names the work, the pay and the when*,
 * and three words in the first field is not a description of a job. The pay and
 * the when are genuinely short — *$120.000* and *el sábado* are complete answers.
 */
export const OFFER_LIMITS = {
  workDescription: { min: 20, max: 600 },
  payTerms: { min: 1, max: 120 },
  whenText: { min: 1, max: 120 },
  hirerName: { min: 1, max: 80 },
  hirerPhone: { min: 7, max: 20 },
} as const;

const trimmed = z.string().trim();

export const workDescriptionField = trimmed
  .min(OFFER_LIMITS.workDescription.min, WORK_TOO_SHORT)
  .max(OFFER_LIMITS.workDescription.max, WORK_TOO_LONG);

export const payTermsField = trimmed
  .min(OFFER_LIMITS.payTerms.min, PAY_REQUIRED)
  .max(OFFER_LIMITS.payTerms.max, PAY_TOO_LONG);

export const whenTextField = trimmed
  .min(OFFER_LIMITS.whenText.min, WHEN_REQUIRED)
  .max(OFFER_LIMITS.whenText.max, WHEN_TOO_LONG);

export const hirerNameField = trimmed
  .min(OFFER_LIMITS.hirerName.min, HIRER_NAME_REQUIRED)
  .max(OFFER_LIMITS.hirerName.max, HIRER_NAME_TOO_LONG);

/**
 * A number, loosely — digits, spaces, hyphens, dots, parentheses and a leading
 * `+`, between seven and twenty characters.
 *
 * **Deliberately looser than `@repo/domain/policy`'s normaliser**, which is what
 * actually decides. A Hirer may be anywhere in the world (`PRODUCT.md`), so a
 * browser-side rule tight enough to be useful would refuse real numbers from
 * places nobody thought about — and refusing a real person in a browser is worse
 * than a round trip. This catches a typed sentence and lets the server judge a
 * number.
 */
export const hirerPhoneField = trimmed
  .min(OFFER_LIMITS.hirerPhone.min, HIRER_PHONE_LOOKS_WRONG)
  .max(OFFER_LIMITS.hirerPhone.max, HIRER_PHONE_LOOKS_WRONG)
  .regex(/^\+?[\d\s().-]+$/u, HIRER_PHONE_LOOKS_WRONG);

/**
 * The *autorización*'s checkbox. `true` or refused; there is no third state.
 *
 * **This is the whole guarantee, and it sits here rather than in the domain**
 * (#250). `offers.send` takes no consent field at all and records a Consent row
 * for any first Offer that carries an identity, so the strict parse below is the
 * only thing between an unticked box and a row asserting he authorized the
 * transmission — the same place the publishing form keeps its own. The
 * `required` attribute is a courtesy that `noValidate` removes once the form
 * hydrates; this is what refuses after that, in the browser and in the action.
 */
export const offerConsentField = z.literal(true, { message: OFFER_CONSENT_REQUIRED });

/**
 * **The lenient shape the action's `inputSchema` takes.**
 *
 * `FormData` arrives as strings and a missing field arrives as nothing at all,
 * so this coerces both into the object the strict parse below judges. It refuses
 * nothing it can represent — which is what keeps a refusal's sentence ours
 * rather than next-safe-action's, and what lets the strict parse run inside the
 * action where his values can travel back with the verdict.
 */
const offerValues = z.object({
  workDescription: z.string().default(""),
  payTerms: z.string().default(""),
  whenText: z.string().default(""),
  hirerName: z.string().optional(),
  hirerPhone: z.string().optional(),
  /**
   * Whether the *autorización* was ticked — shown only on his first Offer.
   *
   * **A boolean, defaulted rather than required.** A later Offer has no box, and
   * a required boolean here would refuse it at `.inputSchema` with a sentence
   * Zod wrote. `false` is what an unticked box and an absent one both mean, and
   * only the first-Offer parse has a rule about it.
   */
  consent: z.boolean().default(false),
});

export type OfferValues = z.output<typeof offerValues>;

/** The strict parse for a repeat Offer: the three terms and nothing else. */
export const offerFields = z.object({
  workDescription: workDescriptionField,
  payTerms: payTermsField,
  whenText: whenTextField,
});

/**
 * The strict parse for a first Offer: the three terms, who is writing, and the
 * *autorización* he gives before any of it is collected.
 *
 * Written out rather than `offerFields.extend(...)`, because the two are the
 * arguments of one `safeParse` branch each and the compiler has to keep their
 * fields distinguishable — an extended object narrows to an intersection whose
 * added keys read as `unknown` at the call site, which is where a missing field
 * would stop being caught.
 */
export const firstOfferFields = z.object({
  workDescription: workDescriptionField,
  payTerms: payTermsField,
  whenText: whenTextField,
  hirerName: hirerNameField,
  hirerPhone: hirerPhoneField,
  consent: offerConsentField,
});

function stringOf(raw: FormData, name: string): string {
  const value = raw.get(name);
  return typeof value === "string" ? value : "";
}

/**
 * The same fields, reached from either shape a caller can arrive in.
 *
 * **next-safe-action converts neither shape**, so a `useActionState`-driven
 * submit hands the raw `FormData` over and this is what shapes it. A plain
 * object passes straight through, so a direct call and a test need not build
 * one — and wrapping every schema in this is also what makes `FormData`
 * assignable where the action's own input type is asked for.
 *
 * **The checkbox is read against the value it submits**, as the publishing
 * form's mapper reads it. An unticked box posts no entry at all, and through
 * `stringOf` that is `""` — a value no `true`-literal rule can ever match.
 */
function fromOfferFormData(raw: unknown): unknown {
  return raw instanceof FormData
    ? {
        workDescription: stringOf(raw, "workDescription"),
        payTerms: stringOf(raw, "payTerms"),
        whenText: stringOf(raw, "whenText"),
        hirerName: stringOf(raw, "hirerName"),
        hirerPhone: stringOf(raw, "hirerPhone"),
        consent: raw.get("consent") === "true",
      }
    : raw;
}

/** The lenient parse: what the action accepts, so a refusal can return his values. */
export const offerValuesSchema = z.preprocess(fromOfferFormData, offerValues);

/** The strict parse over either shape: what the browser guards a submit with. */
export const offerFieldsSchema = z.preprocess(fromOfferFormData, offerFields);
export const firstOfferFieldsSchema = z.preprocess(fromOfferFormData, firstOfferFields);

/**
 * What his form posts, echoed back when the server refuses it.
 *
 * Read through a schema rather than trusted, because `input` is typed `unknown`
 * on the wire — and it is the same object the form re-renders from on the
 * unhydrated path, which is what makes *nada de lo que escribiste se perdió*
 * true rather than merely written.
 *
 * Nothing re-ticks the box from this: consent is an act he takes, not a value
 * the form displays back to him.
 */
export const refusedOfferValues = offerValues;

export type RefusedOfferValues = z.output<typeof refusedOfferValues>;

/**
 * The profile's slug and the two consent versions the page displayed, travelling
 * as **bound arguments** rather than as hidden inputs (ADR-0015).
 *
 * All three are values that travel with the submit and that nobody types, so
 * React encodes them into the action reference, the action validates them on
 * arrival, and a browser with JavaScript unavailable still submits them. A
 * hidden `<input>` mirroring the slug is the shape that rule exists to replace —
 * and here it would also be the field an attacker edits to address the Offer to
 * somebody else.
 */
export const offerSlugArg = z.string().min(1, OFFER_PAGE_STALE);

export const offerConsentVersionsArg = z.object({
  notice: z.string().min(1, OFFER_PAGE_STALE),
  authorization: z.string().min(1, OFFER_PAGE_STALE),
});

/**
 * The parse `guardSubmit` runs in the browser, over the form's own bytes.
 *
 * **Which of the two it is depends on whether the identity fields were
 * rendered**, which the page knows and the browser is told. That is a courtesy
 * rather than a rule: the action reads the same fact from his Consent row, and
 * `sendOffer` reads it a third time inside the transaction, where it decides.
 */
export function browserParse(alreadyIdentified: boolean) {
  return alreadyIdentified ? offerFieldsSchema : firstOfferFieldsSchema;
}
