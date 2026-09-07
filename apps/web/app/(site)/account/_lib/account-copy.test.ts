/**
 * The countable half of `docs/policy/voice.md`, over every string `/account`
 * renders.
 *
 * The guide says it outright — _"Every rule below is testable against a single
 * sentence of copy. A rule you cannot fail is not a rule."_ — so the rules that
 * are genuinely mechanical are checked here rather than left to a reviewer's
 * eye. What is **not** here is the half no test can reach: whether the care is
 * aimed at the process rather than at the person. That is the boundary rule, it
 * is the load-bearing one, and it is a reading.
 *
 * **It reads the module rather than an object inside it**, which is the one way
 * this file differs from its seven siblings. They each group their strings into
 * a `*_COPY` object and test that; this module was written as named exports
 * before the convention settled, and reflecting over the namespace covers a
 * string added tomorrow without anyone remembering to add it to a list. What it
 * costs is that a string's role — body or label — cannot be read off the shape,
 * so the two ceilings are applied from the names below.
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
import * as messages from "./messages";

/**
 * The two strings a person reads that are built rather than declared. Both are
 * counted, and the count is the whole reason they take an argument, so each is
 * exercised in both of its forms.
 */
const BUILT_LABELS: readonly [string, string][] = [
  ["closeOthersButton(1)", messages.closeOthersButton(1)],
  ["closeOthersButton(2)", messages.closeOthersButton(2)],
];

const BUILT_COPY: readonly [string, string][] = [
  ["closedOthers(1)", messages.closedOthers(1)],
  ["closedOthers(2)", messages.closedOthers(2)],
];

/**
 * Labels, buttons and headings: five words or fewer. `ACCOUNT_PAGE_TITLE` is
 * read in a browser tab rather than on the page, which is the same budget.
 */
const LABEL_NAMES = new Set([
  "ACCOUNT_TITLE",
  "ACCOUNT_PAGE_TITLE",
  "SESSIONS_HEADING",
  "CURRENT_SESSION_MARKER",
  "FEEDBACK_REGION_LABEL",
]);

/**
 * Every string the module declares. `flatMap` rather than `filter` with a type
 * predicate: the predicate would have to narrow a tuple's second element, which
 * it cannot do, and building the pair is both shorter and honest about it.
 */
const declared: readonly [string, string][] = Object.entries(messages).flatMap(([name, value]) =>
  typeof value === "string" ? [[name, value] as [string, string]] : [],
);

const copy = [...declared, ...BUILT_COPY, ...BUILT_LABELS];

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

  // A promise the platform cannot make, in either construction — and this is the
  // surface most likely to reach for it, because she may be here worried.
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
  const labels = [...declared.filter(([name]) => LABEL_NAMES.has(name)), ...BUILT_LABELS];

  it("covers every name the ceiling is meant for", () => {
    expect(labels.map(([name]) => name)).toHaveLength(LABEL_NAMES.size + BUILT_LABELS.length);
  });

  it.each(labels)("%s is five words or fewer", (_name, value) => {
    expect(wordCount(value)).toBeLessThanOrEqual(LABEL_WORD_CEILING);
  });
});

/**
 * The rules this surface has of its own, each one a decision recorded in
 * `messages.ts` that a later edit could undo without noticing.
 */
describe("the surface's own rules", () => {
  // A session is a browser, not a machine: two browsers on one laptop are two
  // rows, and any device noun would tell her the other one is somewhere else.
  it.each(["aparato", "dispositivo", "teléfono", "computador"])(
    "the current-session marker does not say %o",
    (noun) => {
      expect(messages.CURRENT_SESSION_MARKER.toLowerCase()).not.toContain(noun);
    },
  );

  it("says nothing is wrong when this is the only session", () => {
    expect(messages.ONLY_THIS_SESSION).toBe(
      "Esta es tu única sesión abierta. No hay nada más que cerrar.",
    );
  });

  // The second half is the load-bearing one: without it a person who has just
  // closed sessions cannot tell whether she is about to be signed out too.
  it.each([1, 2])("tells her this session survives, having closed %i", (count) => {
    expect(messages.closedOthers(count)).toContain("Esta sigue abierta.");
  });

  it("quotes the count back at her rather than saying todas", () => {
    expect(messages.closedOthers(2)).toContain("2");
    expect(messages.closeOthersButton(2)).toContain("2");
  });

  // An unreadable `User-Agent` degrades to an honest absence rather than to a
  // placeholder that reads like a device name.
  it("says it does not know, where it does not know", () => {
    expect(messages.deviceLabel(null, null)).toBe(messages.UNKNOWN_DEVICE);
    expect(messages.deviceLabel("Chrome", null)).toBe("Chrome");
    expect(messages.deviceLabel(null, "Android")).toBe("Android");
    expect(messages.deviceLabel("Chrome", "Android")).toBe("Chrome en Android");
  });
});
