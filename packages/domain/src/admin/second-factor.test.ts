/**
 * Seam 1 for `#admin/second-factor`: the code format, the shape rule that tells
 * one kind of code from the other, and the encryption round trip.
 *
 * The values themselves are random, so most of these run over a **population**
 * rather than over one sample. A backup-code generator that produced an
 * ambiguous code once in ten thousand would pass any single-sample test and
 * would fail a person at the door on the one day they needed it.
 */

import {
  ADMIN_CODE_SHAPES,
  BACKUP_CODE_ALPHABET,
  BACKUP_CODE_COUNT,
  classifyAdminCode,
  decryptBackupCodes,
  decryptTotpSecret,
  encryptBackupCodes,
  encryptTotpSecret,
  generateBackupCodes,
  generateTotpSecret,
  manualEntrySecret,
  totpUri,
  verifyBackupCode,
  verifyTotpCode,
} from "#admin/second-factor";

/** Enough samples that a one-in-ten-thousand defect is not a coin toss. */
const POPULATION = 500;

const KEY = "a-secret-long-enough-for-the-configuration-to-build";

describe("generateBackupCodes", () => {
  it("generates the ten runbook §6 asks a person to keep", () => {
    expect(generateBackupCodes()).toHaveLength(BACKUP_CODE_COUNT);
  });

  it("generates distinct codes", () => {
    const codes = generateBackupCodes();

    expect(new Set(codes).size).toBe(codes.length);
  });

  describe("the format, over a population", () => {
    const codes = Array.from({ length: POPULATION }, () => generateBackupCodes()).flat();

    // Eight characters in two hyphenated groups of four, which is the shape a
    // person reads off a screen at speed on the worst day they have had.
    it("is two hyphenated groups of four", () => {
      for (const code of codes) expect(code).toMatch(/^[^-]{4}-[^-]{4}$/);
    });

    /**
     * **The letter is load-bearing rather than cosmetic.** It is what makes "six
     * characters, all digits" unambiguously a TOTP code, and therefore what lets
     * the door's single field accept either kind without asking the person to
     * say which they are typing.
     */
    it("always contains at least one letter", () => {
      for (const code of codes) expect(code).toMatch(/[A-Z]/);
    });

    /**
     * `0`/`O` and `1`/`l`/`I` are the pairs that get transcribed wrong. The
     * lower-case half of that list is excluded by the alphabet being upper case
     * at all, which is why the assertion is written over the alphabet rather
     * than as five character checks.
     */
    it("uses only the reduced alphabet", () => {
      for (const code of codes) {
        for (const character of code.replace("-", "")) {
          expect(BACKUP_CODE_ALPHABET).toContain(character);
        }
      }
    });

    it("excludes the characters that are read wrong", () => {
      for (const excluded of ["0", "O", "1", "l", "I"]) {
        expect(BACKUP_CODE_ALPHABET).not.toContain(excluded);
      }
    });

    /**
     * A generator that used, say, four distinct characters would satisfy every
     * assertion above and be worthless. This is the cheap check that the
     * alphabet is actually being drawn from.
     */
    it("draws on the whole alphabet", () => {
      const seen = new Set(codes.join("").replace(/-/g, ""));

      expect(seen.size).toBe(BACKUP_CODE_ALPHABET.length);
    });
  });
});

/**
 * **The door has one field and the shape is what tells the two apart** — not a
 * radio button, and not a field the caller picks. So the rule is a function with
 * a table rather than a condition inline at the one call site.
 */
describe("classifyAdminCode", () => {
  it.each(["123456", "000000", "999999"])("reads %o as a code from the authenticator", (code) => {
    expect(classifyAdminCode(code)).toBe(ADMIN_CODE_SHAPES.totp);
  });

  it.each(["ABCD-EFGH", "23AB-CD45", "abcd-efgh"])("reads %o as a backup code", (code) => {
    expect(classifyAdminCode(code)).toBe(ADMIN_CODE_SHAPES.backupCode);
  });

  /**
   * Everything that is neither is a backup code, and that is the right default:
   * a six-digit string is the only thing an authenticator produces, so anything
   * else is checked against the codes and refused there. Falling the other way
   * would send a mistyped backup code to a TOTP comparison that can only say no.
   */
  it.each(["", "12345", "1234567", "12 34 56", "123456 "])(
    "reads the unrecognised %o as a backup code",
    (code) => {
      expect(classifyAdminCode(code)).toBe(ADMIN_CODE_SHAPES.backupCode);
    },
  );

  /**
   * The generator's own output, checked against the rule that has to tell it
   * apart. This is the assertion that would catch a later change to either half
   * — a shorter code, a digits-only alphabet — from the side that matters.
   */
  it("never generates a code its own rule reads as a TOTP code", () => {
    for (let sample = 0; sample < POPULATION; sample += 1) {
      for (const code of generateBackupCodes()) {
        expect(classifyAdminCode(code)).toBe(ADMIN_CODE_SHAPES.backupCode);
      }
    }
  });
});

describe("verifyBackupCode", () => {
  it("matches a code and returns the rest", () => {
    const codes = generateBackupCodes();
    const used = codes[3] as string;

    const outcome = verifyBackupCode(codes, used);

    expect(outcome.matched).toBe(true);
    expect(outcome.remaining).not.toContain(used);
    expect(outcome.remaining).toHaveLength(codes.length - 1);
  });

  it("refuses a code that is not in the set and keeps every one of them", () => {
    const codes = generateBackupCodes();

    const outcome = verifyBackupCode(codes, "ZZZZ-ZZZZ");

    expect(outcome.matched).toBe(false);
    expect(outcome.remaining).toEqual(codes);
  });

  /** Each one works once, which is what makes ten codes ten recoveries. */
  it("refuses a code that has already been used", () => {
    const codes = generateBackupCodes();
    const used = codes[0] as string;

    const { remaining } = verifyBackupCode(codes, used);

    expect(verifyBackupCode(remaining, used).matched).toBe(false);
  });

  /**
   * A person reading a code off a screen types what they see, and a manager
   * pastes what it stored. Neither is worth a lockout, and neither weakens the
   * code: the alphabet is upper case, so case carries no entropy to lose.
   */
  it.each(["lower", "spaced"] as const)("accepts a code the person typed %s", (variation) => {
    const codes = generateBackupCodes();
    const code = codes[1] as string;
    const typed = variation === "lower" ? code.toLowerCase() : ` ${code} `;

    expect(verifyBackupCode(codes, typed).matched).toBe(true);
  });

  it("refuses an empty code against an empty set", () => {
    expect(verifyBackupCode([], "").matched).toBe(false);
  });
});

describe("the TOTP secret", () => {
  it("verifies the code an authenticator would be showing", async () => {
    const secret = generateTotpSecret();
    const { createOTP } = await import("@better-auth/utils/otp");

    const code = await createOTP(secret).totp();

    expect(await verifyTotpCode(secret, code)).toBe(true);
  });

  it("refuses a code from another secret", async () => {
    const { createOTP } = await import("@better-auth/utils/otp");
    const code = await createOTP(generateTotpSecret()).totp();

    expect(await verifyTotpCode(generateTotpSecret(), code)).toBe(false);
  });

  it.each(["", "12345", "000000000", "abcdef"])("refuses %o, which is not a code", async (code) => {
    expect(await verifyTotpCode(generateTotpSecret(), code)).toBe(false);
  });

  it("generates a different secret every time", () => {
    const secrets = new Set(Array.from({ length: 100 }, () => generateTotpSecret()));

    expect(secrets.size).toBe(100);
  });

  /**
   * The secret is 32 characters, which is the length the removed plugin
   * generated. Asserted because the base32 form of it is what a person may have
   * to type into an authenticator by hand, and a change to it is a change to
   * that.
   */
  it("is the length the authenticator was enrolled against", () => {
    expect(generateTotpSecret()).toHaveLength(32);
  });
});

describe("totpUri", () => {
  const secret = generateTotpSecret();
  const uri = totpUri(secret, "ana@example.co");

  it("is an otpauth URI", () => {
    expect(uri.startsWith("otpauth://totp/")).toBe(true);
  });

  /**
   * The product's name rather than a hostname: a person moderating daily reads
   * this label in the authenticator far more often than they read a URL.
   */
  it("names the product as the issuer", () => {
    expect(new URL(uri).searchParams.get("issuer")).toBe("Recomencemos");
  });

  it("carries the account the factor belongs to", () => {
    expect(decodeURIComponent(uri)).toContain("ana@example.co");
  });

  /**
   * **The manual-entry secret is what the URI carries**, which is the whole
   * reason it can be typed into an authenticator that will not read a QR. If
   * these two ever disagreed, the fallback on the enrolment screen would enrol a
   * factor the door then refuses.
   */
  it("carries the same secret the screen offers for manual entry", () => {
    expect(new URL(uri).searchParams.get("secret")).toBe(manualEntrySecret(secret));
  });

  it("offers the manual secret in base32, which is what an authenticator accepts", () => {
    expect(manualEntrySecret(secret)).toMatch(/^[A-Z2-7]+$/);
  });
});

/**
 * **Everything on this table is a credential**, and the encryption is the same
 * primitive and the same key the removed plugin used — so the standing rotation
 * hazard is unchanged rather than newly introduced.
 */
describe("encryption at rest", () => {
  it("round-trips the secret", async () => {
    const secret = generateTotpSecret();

    expect(await decryptTotpSecret(await encryptTotpSecret(secret, KEY), KEY)).toBe(secret);
  });

  it("round-trips the codes", async () => {
    const codes = generateBackupCodes();

    expect(await decryptBackupCodes(await encryptBackupCodes(codes, KEY), KEY)).toEqual(codes);
  });

  it("does not store the secret in the clear", async () => {
    const secret = generateTotpSecret();

    expect(await encryptTotpSecret(secret, KEY)).not.toContain(secret);
  });

  it("does not store a code in the clear", async () => {
    const codes = generateBackupCodes();
    const stored = await encryptBackupCodes(codes, KEY);

    for (const code of codes) expect(stored).not.toContain(code);
  });

  /**
   * The rotation hazard, as an assertion rather than as a paragraph: a factor
   * encrypted under one secret does not survive a change of it, which is what
   * makes rotating `BETTER_AUTH_SECRET` an operational event with a recovery
   * step and re-enrolment the break-glass.
   */
  it("cannot be read under a different key", async () => {
    const stored = await encryptTotpSecret(generateTotpSecret(), KEY);

    await expect(decryptTotpSecret(stored, `${KEY}-rotated`)).rejects.toThrow();
  });
});
