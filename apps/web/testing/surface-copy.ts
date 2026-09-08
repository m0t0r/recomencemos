/**
 * The countable rules of [`docs/policy/voice.md`](../../../docs/policy/voice.md)
 * run over one surface's strings, as one function every copy suite calls.
 *
 * **`testing/voice.ts` holds the rules; this holds the cases that assert them.**
 * The split is the one that already existed implicitly: that file is data and
 * pure functions, importable anywhere, and this one calls `describe`/`it` and is
 * therefore only usable inside a suite.
 *
 * It was extracted when a fourth suite copied the block verbatim. Seven `it`s in
 * seven files is the shape `voice.ts`'s own docblock warns about one level down —
 * *"there is simply no way for two hand-kept mirrors of one policy file to stay
 * in step"* — and the mirrors had already begun to differ: some suites checked
 * ALL CAPS on labels and some did not.
 *
 * What is **not** here is the half no test reaches: whether the care is aimed at
 * the process rather than at the person. That is the boundary rule, it is the
 * load-bearing one, and it is a reading a person does.
 */

import {
  EMPTY_LINK_TEXT,
  LABEL_WORD_CEILING,
  NEVER_SAY,
  sentencesOf,
  SENTENCE_WORD_CEILING,
  shoutedWords,
  wordCount,
} from "./voice";

export interface SurfaceCopy {
  /** Everything a person reads on the surface, named so a failure says which string. */
  readonly copy: readonly (readonly [string, string])[];
  /**
   * The subset that is a link or a button, held to the five-word ceiling.
   *
   * **A label belongs in `copy` as well**, not only here: the ceiling and the
   * caps check are all this set buys, so a link left out of `copy` never meets
   * the banned words or `EMPTY_LINK_TEXT` — and `EMPTY_LINK_TEXT` governs link
   * text and nothing else. That gap is exactly how *aquí* would ship.
   */
  readonly labels: readonly (readonly [string, string])[];
}

export function describeSurfaceCopy({ copy, labels }: SurfaceCopy): void {
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

  /**
   * **A surface may legitimately have none**, and an empty `it.each` is a suite
   * Vitest fails to collect — _"No test found in suite"_ — so the block is
   * skipped rather than emitted empty. The standing notices are the first such
   * surface and the reason is a decision rather than an oversight: they carry no
   * action at all, because routing three statements into a click is the
   * small-print shape their brief refuses.
   *
   * The empty case is asserted rather than merely tolerated, so that a surface
   * whose labels went missing still reports something.
   */
  if (labels.length === 0) {
    describe("the links and buttons", () => {
      it("has none, which is this surface's own decision", () => {
        expect(labels).toEqual([]);
      });
    });
    return;
  }

  describe("the links and buttons", () => {
    it.each(labels)("%s is five words or fewer", (_name, value) => {
      expect(wordCount(value)).toBeLessThanOrEqual(LABEL_WORD_CEILING);
    });

    it.each(labels)("%s has no ALL CAPS word", (_name, value) => {
      expect(shoutedWords(value)).toEqual([]);
    });
  });
}
