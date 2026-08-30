/**
 * The mechanism that stops a privacy notice going live naming nobody.
 *
 * Ley 1581 requires the *aviso de privacidad* to name the *responsable del
 * tratamiento* and a mailbox a *consulta* or a *reclamo* reaches. Those are one
 * person's real identity, so they are deployment configuration rather than
 * committed copy — and configuration that is merely *expected* to be set is
 * configuration that ships unset. This is the half that makes the expectation
 * fail loudly instead.
 *
 * **The production branch is the whole point of the file**, so it is driven from
 * both sides: unset, and still carrying the value `.env.example` ships. The
 * second is the one a runbook checkbox would never catch, because everything
 * renders and the page simply names the wrong person.
 *
 * The environment arrives as a parameter, so none of this stubs a global.
 */

import { AppError } from "@repo/errors/app-error";
import {
  RESPONSIBLE_PARTY_PLACEHOLDERS,
  responsibleParty,
  type ResponsiblePartyEnv,
} from "./responsible-party";

const REAL = { name: "Nombre De Prueba", email: "datos@ejemplo.test" };

const production = (overrides: ResponsiblePartyEnv = {}): ResponsiblePartyEnv => ({
  NODE_ENV: "production",
  RESPONSIBLE_PARTY_NAME: REAL.name,
  RESPONSIBLE_PARTY_EMAIL: REAL.email,
  ...overrides,
});

describe("in development", () => {
  // A fresh clone reads `/privacy` end to end without anyone's real name being in
  // git, which is the reason the placeholders are committed at all.
  it("falls back to the placeholders when neither variable is set", () => {
    expect(responsibleParty({ NODE_ENV: "development" })).toEqual({
      name: RESPONSIBLE_PARTY_PLACEHOLDERS.name,
      email: RESPONSIBLE_PARTY_PLACEHOLDERS.email,
    });
  });

  it("prefers a value a developer has set", () => {
    expect(
      responsibleParty({
        NODE_ENV: "development",
        RESPONSIBLE_PARTY_NAME: REAL.name,
        RESPONSIBLE_PARTY_EMAIL: REAL.email,
      }),
    ).toEqual(REAL);
  });
});

describe("in production", () => {
  it("serves what the deploy was told", () => {
    expect(responsibleParty(production())).toEqual(REAL);
  });

  it.each(["RESPONSIBLE_PARTY_NAME", "RESPONSIBLE_PARTY_EMAIL"] as const)(
    "refuses when %s is unset",
    (variable) => {
      expect(() => responsibleParty(production({ [variable]: undefined }))).toThrow(AppError);
    },
  );

  // Whitespace is what a copy-paste into a secrets dashboard leaves behind, and a
  // notice naming a space is a notice naming nobody.
  it.each(["", "   "])("refuses a name that is only %o", (blank) => {
    expect(() => responsibleParty(production({ RESPONSIBLE_PARTY_NAME: blank }))).toThrow(AppError);
  });

  /**
   * The case a runbook checkbox cannot catch: everything is set, everything
   * renders, and the page names a placeholder. `authSecret` refuses the committed
   * development secret for the same reason, and this is that idea applied to a
   * value that is not a credential.
   */
  it.each([
    ["RESPONSIBLE_PARTY_NAME", RESPONSIBLE_PARTY_PLACEHOLDERS.name],
    ["RESPONSIBLE_PARTY_EMAIL", RESPONSIBLE_PARTY_PLACEHOLDERS.email],
  ] as const)("refuses %s when it still carries the development placeholder", (variable, value) => {
    expect(() => responsibleParty(production({ [variable]: value }))).toThrow(AppError);
  });

  describe("the refusal itself", () => {
    function refusal(): AppError {
      try {
        responsibleParty(production({ RESPONSIBLE_PARTY_EMAIL: undefined }));
      } catch (error) {
        return error as AppError;
      }

      throw new Error("responsibleParty() did not refuse");
    }

    // A configuration gap rather than a fault: the request would succeed the
    // moment somebody sets the value, which is what 503 means and 500 does not.
    it("is a 503", () => {
      expect(refusal().status).toBe(503);
    });

    // The only thing an operator reading this at 3am can act on.
    it("names the variable and the runbook step", () => {
      const error = refusal();

      expect(error.message).toContain("RESPONSIBLE_PARTY_EMAIL");
      expect(error.message).toContain("recomencemos-go-live.md");
      expect(error.context).toMatchObject({ variable: "RESPONSIBLE_PARTY_EMAIL" });
    });

    // A legal name is `personal`, and a log line is not the place for one. The
    // message names the variable rather than quoting what it holds.
    it("puts neither value on the line", () => {
      const error = refusal();
      const line = `${error.message} ${JSON.stringify(error.context)}`;

      expect(line).not.toContain(REAL.name);
      expect(line).not.toContain(REAL.email);
    });

    // She reads a refusal, not a stack trace — and one that says trying again is
    // worth it, which is true: the fix needs nothing from her.
    it("tells her something she can read", () => {
      expect(refusal().userMessage).toContain("aviso de privacidad");
    });
  });
});
