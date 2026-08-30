/**
 * The countable half of `docs/policy/voice.md`, over every string the *aviso de
 * privacidad* and the *autorización* render.
 *
 * **Legal text is where these rules are easiest to abandon and hardest to get
 * back.** A privacy notice drifts into statute register one sentence at a time,
 * and the person it is written for is reading it on a phone while deciding
 * whether to type her phone number in. The guide's own line applies: _"a rule you
 * cannot fail is not a rule"_ — so the ceilings that are mechanical are checked
 * here, and the boundary rule, which is a reading, is not.
 *
 * `sign-in-copy.test.ts` set this shape. What is new here is the last two
 * sections: the disclosure Ley 1581 obliges, and the version discipline that
 * makes a Consent row point at something.
 */

import {
  EMPTY_LINK_TEXT,
  LABEL_WORD_CEILING,
  NEVER_SAY,
  sentencesOf,
  SENTENCE_WORD_CEILING,
  shoutedWords,
  STATUTE_REGISTER,
  wordCount,
} from "@/testing/voice";
import {
  AUTHORIZATION_CHECKBOX_HELP,
  AUTHORIZATION_TEXT,
  contactLine,
  CONSENT_LABELS,
  DATA_ITEMS,
  NOTICE_COPY,
  NOTICE_TITLE,
  NOTICE_UNAVAILABLE,
  noticeVersionLine,
  responsibleLine,
  RIGHTS_ITEMS,
  rightsHowLine,
  versionDate,
} from "./messages";
import { PROCESSORS } from "./processors";

const RESPONSABLE = "Nombre De Prueba";
const MAILBOX = "datos@ejemplo.test";

/**
 * Body copy — everything held to twenty words a sentence.
 *
 * The interpolated lines are rendered with a stand-in name and address rather
 * than skipped: a sentence that fits the ceiling only when the variable is empty
 * is a sentence that breaks on the first real deploy.
 */
const body: [string, string][] = [
  ["NOTICE_TITLE", NOTICE_TITLE],
  ...Object.entries(NOTICE_COPY),
  ["AUTHORIZATION_CHECKBOX_HELP", AUTHORIZATION_CHECKBOX_HELP],
  ["NOTICE_UNAVAILABLE", NOTICE_UNAVAILABLE],
  ["responsibleLine", responsibleLine(RESPONSABLE)],
  ["contactLine", contactLine(MAILBOX)],
  ["rightsHowLine", rightsHowLine(MAILBOX)],
  ["noticeVersionLine", noticeVersionLine("2026-08-30")],
  ...AUTHORIZATION_TEXT.map((text, index): [string, string] => [
    `AUTHORIZATION_TEXT[${index}]`,
    text,
  ]),
];

/**
 * List items, which the guide exempts from the sentence ceiling _"not counting
 * the items of a list"_ — an enumeration of what we hold is long for a reason,
 * and shortening it would cost information rather than words. Every other rule
 * still applies to them.
 */
const listItems: [string, string][] = [
  ...DATA_ITEMS.map((item, index): [string, string] => [`DATA_ITEMS[${index}]`, item]),
  ...RIGHTS_ITEMS.map((item, index): [string, string] => [`RIGHTS_ITEMS[${index}]`, item]),
  ...PROCESSORS.map((processor): [string, string] => [processor.name, processor.purpose]),
];

const everything = [...body, ...listItems];
const labels = Object.entries(CONSENT_LABELS);

describe.each(everything)("%s", (_name, value) => {
  it("is not empty", () => {
    expect(value.trim().length).toBeGreaterThan(0);
  });

  it("has no ALL CAPS word", () => {
    expect(shoutedWords(value)).toEqual([]);
  });

  // Never a refusal, never a notice. This whole module is one.
  it("carries no exclamation mark", () => {
    expect(value).not.toContain("!");
    expect(value).not.toContain("¡");
  });

  it.each(NEVER_SAY)("does not say %o", (banned) => {
    expect(value.toLowerCase()).not.toContain(banned);
  });

  // Link text names its destination; these are the phrases that refuse to.
  it.each(EMPTY_LINK_TEXT)("does not say %o", (phrase) => {
    expect(value.toLowerCase()).not.toContain(phrase);
  });

  /**
   * Sophistication 2, with the guide's own exception: _"the only permitted
   * exceptions are the terms Ley 1581 requires by name"_. Four are permitted, so
   * the institutional register that is **not** on that list is what this refuses.
   */
  it.each(STATUTE_REGISTER)("does not lapse into statute register with %o", (phrase) => {
    expect(value.toLowerCase()).not.toContain(phrase);
  });
});

describe("body copy", () => {
  it.each(body)("%s keeps every sentence to twenty words", (_name, value) => {
    const sentences = sentencesOf(value);

    expect(sentences.length).toBeGreaterThan(0);
    for (const sentence of sentences) {
      expect(wordCount(sentence)).toBeLessThanOrEqual(SENTENCE_WORD_CEILING);
    }
  });
});

describe("labels", () => {
  it.each(labels)("%s is five words or fewer", (_name, value) => {
    expect(wordCount(value)).toBeLessThanOrEqual(LABEL_WORD_CEILING);
  });

  // Link text names its destination. `aquí` and `más información` are the two
  // phrases that refuse to, and both are also what a screen reader reads out of
  // a list of links with no context around them.
  it("names the notice rather than saying aquí", () => {
    const link = CONSENT_LABELS.NOTICE_LINK.toLowerCase();
    expect(link).toContain("aviso de privacidad");
    expect(link).not.toContain("aquí");
    expect(link).not.toContain("más información");
  });
});

describe("what Ley 1581 obliges the notice to say", () => {
  // C15: every processor is a transmisión, so each is named with its country and
  // what it is for. Six of them, and the count is asserted because a vendor added
  // to the stack and not to this list is the failure that has no other symptom.
  it("names six processors, each with a country and a purpose", () => {
    expect(PROCESSORS).toHaveLength(6);

    for (const processor of PROCESSORS) {
      expect(processor.name.trim().length).toBeGreaterThan(0);
      expect(processor.country.trim().length).toBeGreaterThan(0);
      expect(processor.purpose.trim().length).toBeGreaterThan(0);
    }
  });

  it.each(["PlanetScale", "Fly.io", "Cloudflare", "Google", "Resend", "Sentry"])(
    "names %s",
    (vendor) => {
      expect(PROCESSORS.map((processor) => processor.name)).toContain(vendor);
    },
  );

  // The transmission is what makes the authorization express rather than implied,
  // so the autorización itself has to carry it — not only the section above it.
  it("takes express consent to sending the data out of the country", () => {
    const text = AUTHORIZATION_TEXT.join(" ").toLowerCase();
    expect(text).toContain("fuera de colombia");
    expect(AUTHORIZATION_CHECKBOX_HELP.toLowerCase()).toContain("fuera de colombia");
  });

  // A permission she cannot picture withdrawing is not one she has really given,
  // and revocation is a right the notice has to state.
  it("says the authorization can be withdrawn", () => {
    expect(AUTHORIZATION_TEXT.join(" ").toLowerCase()).toContain("quitar esta autorización");
    expect(RIGHTS_ITEMS.join(" ").toLowerCase()).toContain("quitar tu autorización");
  });

  // The two clocks are the law's, and they are stated in the surface a person
  // reads rather than only in the runbook that has to meet them.
  it("states the consulta and reclamo clocks", () => {
    const line = rightsHowLine(MAILBOX).toLowerCase();
    expect(line).toContain("diez días hábiles");
    expect(line).toContain("quince");
  });

  it("names the responsable and a mailbox in the same section", () => {
    expect(responsibleLine(RESPONSABLE)).toContain(RESPONSABLE);
    expect(responsibleLine(RESPONSABLE)).toContain("responsable del tratamiento");
    expect(contactLine(MAILBOX)).toContain(MAILBOX);
  });

  /**
   * ADR-0008's non-verification notice belongs to story 11 and is rendered on the
   * Wall, on every profile and on every Offer surface. A half-version here would
   * give it a second source, and the one thing worse than an absent notice is two
   * that disagree.
   */
  it("does not restate the non-verification notice", () => {
    const everythingSaid = everything.map(([, value]) => value.toLowerCase()).join(" ");
    expect(everythingSaid).not.toContain("no verificamos");
  });
});

describe("the version a Consent row points at", () => {
  // Never `30/08/2026`, which reads as August in one country and October in
  // another. The month is spelled and the year is present.
  it("renders as an es-CO date with the month spelled out", () => {
    expect(versionDate("2026-08-30")).toBe("30 de agosto de 2026");
  });

  /**
   * **Formatted in UTC rather than in `America/Bogota`.** A version is a calendar
   * date, not an instant; rendering it in a UTC−5 zone moves it back a day, which
   * would put one date in the database row and a different one on the page the
   * row points at.
   */
  it("does not slip a day into the previous month", () => {
    expect(versionDate("2026-09-01")).toBe("1 de septiembre de 2026");
    expect(versionDate("2026-01-01")).toBe("1 de enero de 2026");
  });
});
