import { FIELD_LABELS, summaryHeading } from "./messages";
import { publishProfileFields } from "./schema";
import { serverFieldError, summaryFromIssues, summaryFromValidationErrors } from "./summary";

describe("summaryFromIssues", () => {
  it("lists one item per field, in reading order, and counts them in the heading", () => {
    const result = publishProfileFields.safeParse({
      fullName: "",
      firstName: "",
      lastInitial: "",
      city: "pereira",
      headline: "",
      about: "",
      phone: "300 123 4567",
      skillSlugs: ["home-cooking"],
      workHistory: [],
      consent: true,
    });
    if (result.success) throw new Error("expected a refusal");

    const summary = summaryFromIssues(result.error.issues);

    expect(summary?.heading).toBe(summaryHeading(4));
    expect(summary?.items.map((item) => item.field)).toEqual([
      "headline",
      "firstName",
      "lastInitial",
      "fullName",
    ]);
  });

  it("names the work-history line by index", () => {
    const result = publishProfileFields.safeParse({
      fullName: "Ana",
      firstName: "Ana",
      lastInitial: "R",
      city: "pereira",
      headline: "Cocino",
      about: "",
      phone: "300 123 4567",
      skillSlugs: ["home-cooking"],
      workHistory: ["", "a".repeat(121)],
      consent: true,
    });
    if (result.success) throw new Error("expected a refusal");

    const summary = summaryFromIssues(result.error.issues);

    expect(summary?.items).toEqual([
      { field: "workHistory", index: 1, message: expect.stringContaining("120") },
    ]);
  });

  it("is nothing when there are no issues", () => {
    expect(summaryFromIssues([])).toBeUndefined();
  });
});

describe("summaryFromValidationErrors", () => {
  const errors = {
    _errors: [],
    phone: { _errors: ["Ese número no parece un teléfono colombiano."] },
    workHistory: { _errors: [], 2: { _errors: ["Esta línea tiene un correo: «a@b.co»."] } },
    skillSlugs: { _errors: ["Escoge al menos una capacidad."] },
  };

  it("reads the server's formatted shape in reading order, lines included", () => {
    const summary = summaryFromValidationErrors(errors);

    expect(summary?.heading).toBe(summaryHeading(3));
    expect(summary?.items).toEqual([
      { field: "skillSlugs", message: "Escoge al menos una capacidad." },
      { field: "phone", message: "Ese número no parece un teléfono colombiano." },
      { field: "workHistory", index: 2, message: "Esta línea tiene un correo: «a@b.co»." },
    ]);
  });

  it("is nothing for an empty or absent verdict", () => {
    expect(summaryFromValidationErrors(undefined)).toBeUndefined();
    expect(summaryFromValidationErrors({ _errors: [] })).toBeUndefined();
  });

  it("answers per field, and per work-history line", () => {
    expect(serverFieldError(errors, "phone")).toContain("teléfono");
    expect(serverFieldError(errors, "workHistory", 2)).toContain("correo");
    expect(serverFieldError(errors, "workHistory", 0)).toBeUndefined();
    expect(serverFieldError(errors, "headline")).toBeUndefined();
  });

  it("only ever names a field the form has a label for", () => {
    const summary = summaryFromValidationErrors({ ...errors, passwordHash: { _errors: ["x"] } });

    for (const item of summary?.items ?? []) {
      expect(item.field in FIELD_LABELS).toBe(true);
    }
  });
});
