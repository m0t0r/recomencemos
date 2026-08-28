/**
 * The countable half of `docs/policy/voice.md`, over every string `/sign-in`
 * renders.
 *
 * The guide says it outright — _"Every rule below is testable against a single
 * sentence of copy. A rule you cannot fail is not a rule."_ — so the rules that
 * are genuinely mechanical are checked here rather than left to a reviewer's
 * eye. What is **not** here is the half no test can reach: whether the care is
 * aimed at the process rather than at the person. That is the boundary rule, it
 * is the load-bearing one, and it is a reading.
 *
 * A string added to `SIGN_IN_COPY` is a string put under these rules. That is
 * the point of the object existing.
 */

import { checkYourEmail, SIGN_IN_COPY, SIGN_IN_LABELS } from "./messages";

/**
 * The confirmation is a function of the link's lifetime, and the authority on
 * that number is `MAGIC_LINK_TTL_MINUTES` in `@repo/domain` — which this module
 * deliberately cannot import, because it is reached from a Client Component and
 * that import pulls `#connection` onto the client graph. Fifteen here is an
 * illustrative argument, not a second source of truth: `actions.ts` passes the
 * real one, and it runs on the server.
 */
const CHECK_YOUR_EMAIL = checkYourEmail(15);

const copy = [...Object.entries(SIGN_IN_COPY), ["CHECK_YOUR_EMAIL", CHECK_YOUR_EMAIL]] as [
  string,
  string,
][];
const labels = Object.entries(SIGN_IN_LABELS);

/**
 * `CONTEXT.md`'s _Avoid_ lists, plus the voice guide's **Never say**.
 *
 * Every one of these names a person by an event or by a category rather than by
 * a capability, or promises something this platform does not hold.
 */
const NEVER_SAY = [
  "damnificad",
  "víctima",
  "afectad",
  "beneficiari",
  "necesitad",
  "donación",
  "donar",
  "causa",
  "tu historia",
  "candidat",
  "aspirante",
  "hoja de vida",
  "vacante",
  "empleo",
  "oferta laboral",
  "empleador",
  "usuari",
  "verificado",
];

describe.each(copy)("%s", (name, value) => {
  it("is not empty", () => {
    expect(value.trim().length).toBeGreaterThan(0);
  });

  // Some screen readers spell them out, and it reads as shouting.
  it("has no ALL CAPS word", () => {
    const shouted = value.split(/\s+/).filter((word) => /^[A-ZÁÉÍÓÚÑ]{2,}$/.test(word));
    expect(shouted).toEqual([]);
  });

  // No exclamation marks. The one permitted exception is a success state, and
  // this surface's success state does not use it.
  it("carries no exclamation mark", () => {
    expect(value).not.toContain("!");
    expect(value).not.toContain("¡");
  });

  it.each(NEVER_SAY)("does not say %o", (banned) => {
    expect(value.toLowerCase()).not.toContain(banned);
  });

  // Link text names its destination; these are the phrases that refuse to.
  it.each(["haz clic aquí", "clic aquí", "más información", "aquí."])(
    "does not say %o",
    (phrase) => {
      expect(value.toLowerCase()).not.toContain(phrase);
    },
  );
});

describe("body copy", () => {
  // 20 words or fewer per sentence, not counting the items of a list. Nothing
  // here is a list.
  it.each(copy)("%s keeps every sentence to twenty words", (_name, value) => {
    const sentences = value
      .split(/[.]/)
      .map((sentence) => sentence.trim())
      .filter(Boolean);

    expect(sentences.length).toBeGreaterThan(0);
    for (const sentence of sentences) {
      expect(sentence.split(/\s+/).length).toBeLessThanOrEqual(20);
    }
  });
});

describe("labels and buttons", () => {
  // Five words or fewer. Countable, which is the point.
  it.each(labels)("%s is five words or fewer", (_name, value) => {
    expect(value.split(/\s+/).length).toBeLessThanOrEqual(5);
  });

  // A button says the verb of its action, not `Enviar` or `Continuar` alone.
  it.each([
    ["SEND_LINK_BUTTON", SIGN_IN_LABELS.SEND_LINK_BUTTON],
    ["RESEND_LINK_BUTTON", SIGN_IN_LABELS.RESEND_LINK_BUTTON],
    ["GOOGLE_BUTTON", SIGN_IN_LABELS.GOOGLE_BUTTON],
  ])("%s is not a bare Enviar or Continuar", (_name, value) => {
    expect(value).not.toBe("Enviar");
    expect(value).not.toBe("Continuar");
    expect(value.split(/\s+/).length).toBeGreaterThan(1);
  });
});

describe("the sentences the ticket names specifically", () => {
  // "The surface says she needs an address she can open **before** she types
  // one" — so this string has to actually say it.
  it("tells her she needs a mailbox she can open, before the field", () => {
    expect(SIGN_IN_COPY.EMAIL_DOOR_PRECONDITION).toContain("correo");
    expect(SIGN_IN_COPY.EMAIL_DOOR_PRECONDITION).toContain("abrir");
  });

  // Said whether or not the address exists, so it must not hedge on existence.
  it.each(["si esa dirección", "si existe", "si tienes cuenta", "si estás registrad"])(
    "does not hedge the sent confirmation with %o",
    (hedge) => {
      expect(CHECK_YOUR_EMAIL.toLowerCase()).not.toContain(hedge);
    },
  );

  // Google failed → the email door is still offered, never a dead end.
  it("offers the email door when Google fails", () => {
    expect(SIGN_IN_COPY.GOOGLE_FAILED).toContain("correo");
  });

  // A consumed link offers an immediate resend, and is not written as an error.
  it("offers a resend on a consumed link, without calling it an error", () => {
    expect(SIGN_IN_COPY.LINK_ALREADY_USED.toLowerCase()).toContain("otro");
    expect(SIGN_IN_COPY.LINK_ALREADY_USED.toLowerCase()).not.toContain("error");
  });

  // The shared-device help says what it does in the unit she thinks in.
  it("says the shared-device session length in hours", () => {
    expect(SIGN_IN_COPY.SHARED_DEVICE_HELP).toContain("8 horas");
  });

  // The borrowed-Android notice tells her she will choose, which is true only
  // because the provider is configured with `prompt: "select_account"`.
  it("says Google will ask which account", () => {
    expect(SIGN_IN_COPY.GOOGLE_ACCOUNT_NOTICE.toLowerCase()).toContain("cuenta");
  });
});
