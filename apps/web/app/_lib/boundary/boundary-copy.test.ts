/**
 * The countable half of the voice guide over the three app-wide boundaries,
 * plus the two rules that are this surface's alone.
 *
 * The shared cases are the same set the seven other `*-copy.test.ts` suites run,
 * out of `@/testing/voice`, so a rule added to the guide reaches every surface
 * from one place rather than from eight hand-kept mirrors.
 */

import {
  EMPTY_LINK_TEXT,
  LABEL_WORD_CEILING,
  NEVER_SAY,
  sentencesOf,
  SENTENCE_WORD_CEILING,
  shoutedWords,
  wordCount,
} from "@/testing/voice";
import {
  BOUNDARY_COPY,
  BOUNDARY_LABELS,
  NOT_FOUND_EXPLANATION,
  NOT_FOUND_ONWARD,
  NOT_FOUND_PAGE_TITLE,
  NOT_FOUND_TITLE,
  ROOT_ERROR_PAGE_TITLE,
} from "./messages";

const copy = Object.entries(BOUNDARY_COPY);

describe.each(copy)("%s", (_name, value) => {
  it("is not empty", () => {
    expect(value.trim().length).toBeGreaterThan(0);
  });

  it("has no ALL CAPS word", () => {
    expect(shoutedWords(value)).toEqual([]);
  });

  // Never a refusal, never a notice — and every string here is one or the other.
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

  it("does not say seguro", () => {
    expect(value.toLowerCase()).not.toMatch(/\bsegur[oa]\b/);
  });

  it("keeps every sentence to twenty words", () => {
    for (const sentence of sentencesOf(value)) {
      expect(wordCount(sentence)).toBeLessThanOrEqual(SENTENCE_WORD_CEILING);
    }
  });
});

describe("labels", () => {
  it.each(Object.entries(BOUNDARY_LABELS))("%s is five words or fewer", (_name, value) => {
    expect(wordCount(value)).toBeLessThanOrEqual(LABEL_WORD_CEILING);
  });

  it.each(Object.entries(BOUNDARY_LABELS))("%s has no ALL CAPS word", (_name, value) => {
    expect(shoutedWords(value)).toEqual([]);
  });
});

/**
 * The rule that is this surface's own, and the reason it is a test rather than a
 * comment.
 *
 * Three of the four ways a person reaches the not-found page are the spec's
 * `permission denied` cell answered as a 404 deliberately — not the owner at
 * `/my-profile`, and a spent, expired or unknown token at either token route,
 * where the spec's words are that a legible refusal is an oracle for which
 * tokens existed. The fourth is a mistyped URL.
 *
 * So the page must read identically to all four. Each case below is one way a
 * later edit would quietly pick one of them out — an invitation to sign in, a
 * word about permission, a confident claim that nothing is there, or the name of
 * a route only one population was reaching for.
 */
describe("the not-found copy is not an oracle", () => {
  // The document title is in the set: it is read before the page paints and is
  // what survives into a browser's history, so it leaks exactly as loudly as the
  // heading would.
  const notFound = [NOT_FOUND_TITLE, NOT_FOUND_PAGE_TITLE, NOT_FOUND_EXPLANATION, NOT_FOUND_ONWARD];

  const authorization = [
    "sesión",
    "entra",
    "entrar",
    "permiso",
    "autorizad",
    "acceso",
    "cuenta",
    "dueñ",
    "tuya",
    "tuyo",
  ];

  it.each(authorization)("says nothing about %o", (word) => {
    for (const value of notFound) {
      expect(value.toLowerCase()).not.toContain(word);
    }
  });

  /**
   * A route named here is a route the reader was not necessarily asking for.
   * `/admin` in particular: the token surfaces refuse without ever naming it,
   * and this page answers for them.
   */
  it.each(["/admin", "/my-profile", "/publish", "admin", "token"])(
    "names no route or credential (%o)",
    (fragment) => {
      for (const value of notFound) {
        expect(value.toLowerCase()).not.toContain(fragment);
      }
    },
  );

  /**
   * The hedge is load-bearing. A flat assertion that the page does not exist is
   * false for three of the four populations, and false in the direction that
   * tells a prober the resource is absent when it is present.
   */
  it("does not claim the page never existed", () => {
    expect(NOT_FOUND_EXPLANATION.toLowerCase()).not.toMatch(/\bno existe\b/);
    expect(NOT_FOUND_TITLE.toLowerCase()).not.toMatch(/\bno existe\b/);
  });

  it("offers somewhere to go instead", () => {
    expect(NOT_FOUND_ONWARD.toLowerCase()).toContain("muro");
  });
});

/**
 * The root boundary supplies its own `<title>`, because it replaces the root
 * layout and `metadata` is not in play. A document with no title fails WCAG
 * 2.4.2; one titled in the wrong language is announced with the wrong phonemes,
 * which is the same mistake `lang` makes and is why both moved together.
 */
describe("the root boundary's document title", () => {
  it("names the product", () => {
    expect(ROOT_ERROR_PAGE_TITLE).toContain("Recomencemos");
  });

  it("is Spanish, not the English it replaced", () => {
    expect(ROOT_ERROR_PAGE_TITLE.toLowerCase()).not.toContain("something went wrong");
  });
});
