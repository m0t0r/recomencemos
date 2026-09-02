/**
 * The boundary parse, as one rule rather than two implementations: the
 * browser validates with the very objects the Server Action parses with, so
 * what is worth pinning is the rule itself, the `FormData` boundary a caller
 * could break without noticing, and the one thing this module restates from
 * the domain because the browser may not import it.
 */

import { CITY_IDS as DOMAIN_CITY_IDS } from "@repo/domain/policy";
import {
  CITY_IDS,
  consentVersionsArg,
  lastInitialField,
  phoneField,
  publishProfileFields,
  publishProfileSchema,
  skillSlugsField,
} from "./schema";
import { PUBLISH_COPY } from "./messages";

const VALID = {
  fullName: "Ana María Restrepo Gómez",
  firstName: "Ana María",
  lastInitial: "r",
  city: "pereira",
  headline: "Cocino almuerzos y comida casera",
  about: "",
  phone: "300 123 4567",
  skillSlugs: ["home-cooking"],
  workHistory: [],
  consent: true,
} as const;

describe("the city list", () => {
  // The browser may not import the domain, so the ids are restated. This is
  // what keeps the restatement honest.
  it("is the domain's own, in the same order", () => {
    expect([...CITY_IDS]).toEqual([...DOMAIN_CITY_IDS]);
  });
});

describe("the fields", () => {
  it("accepts a complete submission", () => {
    expect(VALID).toMatchSchema(publishProfileFields);
  });

  it("upper-cases the initial the way es-CO does", () => {
    expect(lastInitialField.parse("ñ")).toBe("Ñ");
    expect(lastInitialField.parse(" r ")).toBe("R");
  });

  it.each(["", "Re", "1", "R."])("refuses %o as an initial", (value) => {
    expect(value).not.toMatchSchema(lastInitialField);
  });

  it.each(["300 123 4567", "+57 300 123 4567", "(300) 123-4567", "3001234567"])(
    "accepts %o as a phone shape",
    (value) => {
      expect(value).toMatchSchema(phoneField);
    },
  );

  it.each(["", "tres cero cero", "300 123", "300 123 4567 ext"])(
    "refuses %o as a phone shape",
    (value) => {
      expect(value).not.toMatchSchema(phoneField);
    },
  );

  it("wants at least one Skill and at most six", () => {
    expect([]).not.toMatchSchema(skillSlugsField);
    expect(["a", "b", "c", "d", "e", "f", "g"]).not.toMatchSchema(skillSlugsField);
    expect(["home-cooking", "baking-and-pastry"]).toMatchSchema(skillSlugsField);
  });

  it("refuses a Skill value that is not an identifier from the picker", () => {
    expect(["Cocinar almuerzos"]).not.toMatchSchema(skillSlugsField);
  });

  it("refuses an unticked consent", () => {
    expect({ ...VALID, consent: false }).not.toMatchSchema(publishProfileFields);
  });

  it("refuses a city that is not one of the three", () => {
    expect({ ...VALID, city: "bogota" }).not.toMatchSchema(publishProfileFields);
  });
});

function formDataOf(entries: [string, string][]): FormData {
  const data = new FormData();
  for (const [name, value] of entries) data.append(name, value);
  return data;
}

describe("the FormData boundary", () => {
  it("reads repeated names as arrays and the consent as a boolean", () => {
    const data = formDataOf([
      ["fullName", VALID.fullName],
      ["firstName", VALID.firstName],
      ["lastInitial", "r"],
      ["city", "pereira"],
      ["headline", VALID.headline],
      ["about", ""],
      ["phone", VALID.phone],
      ["skillSlugs", "home-cooking"],
      ["skillSlugs", "baking-and-pastry"],
      ["workHistory", "Panadería La Espiga"],
      ["workHistory", ""],
      ["consent", "true"],
    ]);

    const parsed = publishProfileSchema.parse(data);

    expect(parsed.skillSlugs).toEqual(["home-cooking", "baking-and-pastry"]);
    expect(parsed.workHistory).toEqual(["Panadería La Espiga", ""]);
    expect(parsed.consent).toBe(true);
    expect(parsed.lastInitial).toBe("R");
  });

  it("refuses a form with the consent box unticked", () => {
    const data = formDataOf([
      ["fullName", VALID.fullName],
      ["firstName", VALID.firstName],
      ["lastInitial", "r"],
      ["city", "pereira"],
      ["headline", VALID.headline],
      ["phone", VALID.phone],
      ["skillSlugs", "home-cooking"],
    ]);

    expect(data).not.toMatchSchema(publishProfileSchema);
  });

  it("takes a plain object too", () => {
    expect(VALID).toMatchSchema(publishProfileSchema);
  });
});

describe("the bound consent versions", () => {
  it("wants both versions, non-empty", () => {
    expect({ notice: "2026-08-30", authorization: "2026-08-30" }).toMatchSchema(consentVersionsArg);
    expect({ notice: "", authorization: "2026-08-30" }).not.toMatchSchema(consentVersionsArg);
  });
});

describe("every refusal", () => {
  /**
   * ADR-0014's second rule as an assertion: nothing Zod authored may reach a
   * person, so every message a refusal can produce must be one of ours.
   */
  it("carries a sentence from the message module, never Zod's", () => {
    const ours = new Set<string>(Object.values(PUBLISH_COPY));
    const result = publishProfileFields.safeParse({
      fullName: "",
      firstName: "",
      lastInitial: "ab",
      city: "x",
      headline: "",
      about: "a".repeat(601),
      phone: "",
      skillSlugs: [],
      workHistory: ["", "", "", "", "", ""],
      consent: false,
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    for (const issue of result.error.issues) {
      expect(ours, `Zod's own words reached a refusal: ${issue.message}`).toContain(issue.message);
    }
  });
});
