/**
 * The Offer form's boundary parse: the *autorización* on a first Offer, and its
 * absence on a later one.
 *
 * The browser guards a submit with the same objects the action parses with, so
 * what is worth pinning is the rule and the `FormData` boundary a caller could
 * break without noticing — an unticked checkbox posts no entry at all, which is
 * the shape that went through unrefused (#250).
 */

import {
  firstOfferFields,
  firstOfferFieldsSchema,
  offerFields,
  offerValuesSchema,
} from "./offer-schema";

const TERMS = {
  workDescription: "Pintar la sala y el comedor de un apartamento",
  payTerms: "$250.000 al terminar",
  whenText: "El sábado desde las ocho",
} as const;

const FIRST = {
  ...TERMS,
  hirerName: "Carlos Mejía",
  hirerPhone: "300 123 4567",
  consent: true,
} as const;

function formDataOf(entries: readonly (readonly [string, string])[]): FormData {
  const data = new FormData();
  for (const [name, value] of entries) data.append(name, value);
  return data;
}

const FIRST_ENTRIES = [
  ["workDescription", TERMS.workDescription],
  ["payTerms", TERMS.payTerms],
  ["whenText", TERMS.whenText],
  ["hirerName", FIRST.hirerName],
  ["hirerPhone", FIRST.hirerPhone],
] as const;

describe("a first Offer", () => {
  it("accepts one with the autorización ticked", () => {
    expect(FIRST).toMatchSchema(firstOfferFields);
  });

  it("refuses one with the autorización absent", () => {
    const { consent: _consent, ...unticked } = FIRST;

    expect(unticked).not.toMatchSchema(firstOfferFields);
  });

  it("refuses one with the autorización false", () => {
    expect({ ...FIRST, consent: false }).not.toMatchSchema(firstOfferFields);
  });

  it("refuses a form whose box was left unticked, which posts no entry at all", () => {
    expect(formDataOf(FIRST_ENTRIES)).not.toMatchSchema(firstOfferFieldsSchema);
  });

  it("accepts a form whose box was ticked", () => {
    expect(formDataOf([...FIRST_ENTRIES, ["consent", "true"]])).toMatchSchema(
      firstOfferFieldsSchema,
    );
  });
});

describe("a later Offer", () => {
  /** Consent is given once, not per send, so the repeat parse has no member for it. */
  it("sends with no autorización, and carries none onward", () => {
    const parsed = offerFields.parse({ ...TERMS, consent: false });

    expect(parsed).not.toHaveProperty("consent");
  });
});

describe("the values the action accepts", () => {
  /**
   * The lenient parse refuses nothing, so the strict one inside the action can
   * answer with a sentence of ours — but it has to read the box the way a
   * browser posts it, or no rule over it could ever match.
   */
  it("reads an unticked box as false and a ticked one as true", () => {
    expect(offerValuesSchema.parse(formDataOf(FIRST_ENTRIES)).consent).toBe(false);
    expect(
      offerValuesSchema.parse(formDataOf([...FIRST_ENTRIES, ["consent", "true"]])).consent,
    ).toBe(true);
  });

  it("reads a later Offer's object, which has no box, as unticked", () => {
    expect(offerValuesSchema.parse({ ...TERMS }).consent).toBe(false);
  });
});
