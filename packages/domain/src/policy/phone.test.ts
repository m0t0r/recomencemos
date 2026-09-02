import { formatColombianPhone, normalizeColombianPhone } from "#policy/phone";

describe("normalizeColombianPhone", () => {
  it.each([
    "300 123 4567",
    "3001234567",
    "+57 300 123 4567",
    "57 300 123 4567",
    "(300) 123-4567",
    "+57 (300) 123 45 67",
    "  300.123.4567  ",
  ])("reads %o as one mobile number", (typed) => {
    expect(normalizeColombianPhone(typed)).toEqual({ ok: true, e164: "+573001234567" });
  });

  it("reads a landline in the national format", () => {
    expect(normalizeColombianPhone("606 123 4567")).toEqual({ ok: true, e164: "+576061234567" });
  });

  it.each(["", "300 123", "123 456 7890", "+34 612 34 56 78", "300 123 4567 89", "tres cero cero"])(
    "refuses %o",
    (typed) => {
      expect(normalizeColombianPhone(typed)).toEqual({ ok: false });
    },
  );
});

describe("formatColombianPhone", () => {
  it("shows the stored number the way she says it", () => {
    expect(formatColombianPhone("+573001234567")).toBe("300 123 4567");
  });

  it("leaves a number it does not recognise alone rather than mangling it", () => {
    expect(formatColombianPhone("+34612345678")).toBe("+34612345678");
  });
});
