/**
 * The voice suite the two public lists share, as one function each surface
 * calls with its own strings.
 *
 * `/` and `/profiles` are two surfaces with two `_lib`s and the prior art is one
 * copy suite per surface — `publish-copy`, `my-profile-copy`, `sign-in-copy`.
 * What they do not have is a third module of shared strings between them, which
 * these two do, so the rules run from here and each surface names what it
 * renders. A string that reaches a screen and appears in neither list is the
 * failure this shape is guarding against.
 *
 * The rules themselves are `testing/voice.ts`'s. What is **not** here is the
 * half no test reaches: whether the care is aimed at the process rather than at
 * the person, which is a reading a person does.
 */

import {
  EMPTY_LINK_TEXT,
  LABEL_WORD_CEILING,
  NEVER_SAY,
  SENTENCE_WORD_CEILING,
  sentencesOf,
  shoutedWords,
  wordCount,
} from "./voice";

export interface ListCopy {
  /** Everything a person reads on the surface, named so a failure says which string. */
  readonly copy: readonly (readonly [string, string])[];
  /** The subset that is a link or a button, held to the five-word ceiling. */
  readonly labels: readonly (readonly [string, string])[];
}

export function describeListCopy({ copy, labels }: ListCopy): void {
  describe.each(copy)("%s", (_name, value) => {
    it("is not empty", () => {
      expect(value.trim().length).toBeGreaterThan(0);
    });

    it("has no ALL CAPS word", () => {
      expect(shoutedWords(value)).toEqual([]);
    });

    it("carries no exclamation mark", () => {
      expect(value).not.toContain("!");
      expect(value).not.toContain("¡");
    });

    it.each(NEVER_SAY)("does not say %o", (banned) => {
      expect(value.toLowerCase()).not.toContain(banned);
    });

    it.each(EMPTY_LINK_TEXT)("does not say %o", (phrase) => {
      expect(value.toLowerCase()).not.toContain(phrase);
    });

    /** A promise the platform cannot make, in either construction. */
    it("does not say seguro", () => {
      expect(value.toLowerCase()).not.toMatch(/\bsegur[oa]\b/);
    });

    it("keeps every sentence to twenty words", () => {
      for (const sentence of sentencesOf(value)) {
        expect(wordCount(sentence)).toBeLessThanOrEqual(SENTENCE_WORD_CEILING);
      }
    });
  });

  describe("the links and buttons", () => {
    it.each(labels)("%s is five words or fewer", (_name, value) => {
      expect(wordCount(value)).toBeLessThanOrEqual(LABEL_WORD_CEILING);
    });
  });

  /**
   * **Neither list claims anything about verification or money.** Those are
   * story 11's two standing notices, and a half-version on a list would give
   * them a second source — which is the one thing worse than an absent notice.
   */
  describe("what this list does not say", () => {
    const everything = copy
      .map(([, value]) => value)
      .join(" ")
      .toLowerCase();

    it("makes no claim about verification", () => {
      expect(everything).not.toMatch(/verifica/);
    });

    it("makes no claim about money", () => {
      expect(everything).not.toMatch(/\b(dinero|pagos|plata|comisión)\b/);
    });

    /**
     * The ordering is a property of the list, and a card carrying "has received
     * no proposals" would label a person by what has not happened to her. No
     * string a *card* renders mentions a proposal at all.
     */
    it("never says on a card what the list says about itself", () => {
      const cardStrings = copy.filter(([name]) => name.startsWith("photoAlt"));

      for (const [, value] of cardStrings) {
        expect(value.toLowerCase()).not.toMatch(/propuesta/);
      }
    });
  });
}
