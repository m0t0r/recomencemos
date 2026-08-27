/**
 * The boundary parse, tested as one rule rather than as two implementations.
 *
 * The whole reason the schema is shared is that the browser's answer and the
 * server's must be the same answer; this drives the shared function, so a
 * divergence would have to be introduced deliberately rather than by drift.
 */

import { isAcceptableAddress, parseRequestMagicLink } from "./schema";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

describe("isAcceptableAddress", () => {
  // The point of the shallowness. Each of these is a real address that a
  // stricter validator has been known to refuse, and refusing one locks a Worker
  // out of the only door she has.
  it.each([
    "ana@example.co",
    "ana+trabajo@example.co",
    "ana.maria@example.com.co",
    "ana@correo.example.co",
    "anamaría@example.co",
    "a@b.co",
    "ana@example.tecnologia",
  ])("accepts %o", (address) => {
    expect(isAcceptableAddress(address)).toBe(true);
  });

  // The typo she can still see in the field, and nothing beyond it.
  it.each(["", "   ", "ana", "ana@", "@example.co", "ana @example.co", "ana@example", "ana@.co"])(
    "refuses %o",
    (address) => {
      expect(isAcceptableAddress(address)).toBe(false);
    },
  );

  it("ignores space she did not mean to type", () => {
    expect(isAcceptableAddress("  ana@example.co  ")).toBe(true);
  });
});

describe("parseRequestMagicLink", () => {
  it("returns the trimmed address", () => {
    const result = parseRequestMagicLink(form({ email: "  ana@example.co " }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.email).toBe("ana@example.co");
  });

  // `"on"` is what a checked checkbox posts. One spelling, decided here.
  it.each([
    ["on", true],
    ["off", false],
  ])("reads sharedDevice %o as %o", (posted, expected) => {
    const result = parseRequestMagicLink(form({ email: "ana@example.co", sharedDevice: posted }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.sharedDevice).toBe(expected);
  });

  // The safe reading of an absent answer is own-device, because the box is
  // opt-in and reading silence as "shared" would put every Worker on 8 hours.
  it("reads an absent sharedDevice as own device", () => {
    const result = parseRequestMagicLink(form({ email: "ana@example.co" }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.sharedDevice).toBe(false);
  });

  it("names the field that was wrong", () => {
    const result = parseRequestMagicLink(form({ email: "ana" }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors.email).toBeDefined();
  });

  // Zod's own messages are English and are not under `docs/policy/voice.md`.
  // Nothing this returns is rendered; the sentence comes from `messages.ts`.
  it("does not carry Zod's English message toward a person", () => {
    const result = parseRequestMagicLink(form({ email: "ana" }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(JSON.stringify(result.fieldErrors)).not.toMatch(/invalid|expected|string/i);
  });

  // Shape only. Whether the path is *safe* is `safeReturnPath`'s question in
  // `@repo/domain`, and this must not look like it has been answered here.
  it("passes returnPath through without judging it", () => {
    const result = parseRequestMagicLink(
      form({ email: "ana@example.co", returnPath: "//evil.co" }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.returnPath).toBe("//evil.co");
  });
});
