/**
 * The countable half of the voice guide, over every string the two public lists
 * render — the Wall's, `/profiles`', and the ones they share.
 *
 * One suite for both because they are one surface pair with one shared message
 * module, and splitting it would put the shared strings in neither file or in
 * both. What no test here reaches is the boundary rule — whether the care is
 * aimed at the process rather than at the person — which stays a reading a
 * person does.
 */

import {
  EMPTY_LINK_TEXT,
  LABEL_WORD_CEILING,
  NEVER_SAY,
  SENTENCE_WORD_CEILING,
  sentencesOf,
  shoutedWords,
  wordCount,
} from "@/testing/voice";
import {
  announcedCount,
  GRID_ERROR_EXPLANATION,
  GRID_ERROR_RETRY,
  GRID_ERROR_RETRYING,
  GRID_ERROR_TITLE,
  NOBODY_PUBLISHED_BODY,
  NOBODY_PUBLISHED_TITLE,
  photoAlt,
  TO_PUBLISH,
} from "../../_components/profile-grid/messages";
import {
  BROWSE_CLEAR,
  BROWSE_LEAD,
  BROWSE_MORE,
  BROWSE_NARROWED_BODY,
  BROWSE_NARROWED_TITLE,
  BROWSE_PAGE_TITLE,
  BROWSE_TITLE,
} from "../../profiles/_lib/messages";
import { WALL_LEAD, WALL_TITLE, WALL_TO_BROWSE, WALL_TO_BROWSE_HINT } from "./messages";

/** Everything a person reads on either list, including the two derived strings. */
const copy: [string, string][] = [
  ["WALL_TITLE", WALL_TITLE],
  ["WALL_LEAD", WALL_LEAD],
  ["WALL_TO_BROWSE", WALL_TO_BROWSE],
  ["WALL_TO_BROWSE_HINT", WALL_TO_BROWSE_HINT],
  ["BROWSE_PAGE_TITLE", BROWSE_PAGE_TITLE],
  ["BROWSE_TITLE", BROWSE_TITLE],
  ["BROWSE_LEAD", BROWSE_LEAD],
  ["BROWSE_MORE", BROWSE_MORE],
  ["BROWSE_NARROWED_TITLE", BROWSE_NARROWED_TITLE],
  ["BROWSE_NARROWED_BODY", BROWSE_NARROWED_BODY],
  ["BROWSE_CLEAR", BROWSE_CLEAR],
  ["NOBODY_PUBLISHED_TITLE", NOBODY_PUBLISHED_TITLE],
  ["NOBODY_PUBLISHED_BODY", NOBODY_PUBLISHED_BODY],
  ["TO_PUBLISH", TO_PUBLISH],
  ["GRID_ERROR_TITLE", GRID_ERROR_TITLE],
  ["GRID_ERROR_EXPLANATION", GRID_ERROR_EXPLANATION],
  ["GRID_ERROR_RETRY", GRID_ERROR_RETRY],
  ["GRID_ERROR_RETRYING", GRID_ERROR_RETRYING],
  ["announcedCount", announcedCount(12)],
  ["photoAlt", photoAlt("Ana María R.")],
];

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
  const labels: [string, string][] = [
    ["WALL_TO_BROWSE", WALL_TO_BROWSE],
    ["BROWSE_MORE", BROWSE_MORE],
    ["BROWSE_CLEAR", BROWSE_CLEAR],
    ["TO_PUBLISH", TO_PUBLISH],
    ["GRID_ERROR_RETRY", GRID_ERROR_RETRY],
    ["GRID_ERROR_RETRYING", GRID_ERROR_RETRYING],
  ];

  it.each(labels)("%s is five words or fewer", (_name, value) => {
    expect(wordCount(value)).toBeLessThanOrEqual(LABEL_WORD_CEILING);
  });
});

describe("what neither list says", () => {
  const everything = copy
    .map(([, value]) => value)
    .join(" ")
    .toLowerCase();

  /**
   * The two standing notices are story 11's, and a half-version on the Wall
   * would give them a second source — which is the one thing worse than an
   * absent notice. So neither page makes a claim about verification or money.
   */
  it("makes no claim about verification", () => {
    expect(everything).not.toMatch(/verifica/);
  });

  it("makes no claim about money", () => {
    expect(everything).not.toMatch(/\b(dinero|pagos|plata|comisión)\b/);
  });

  /**
   * The ordering is a property of the list. A card carrying "has received no
   * proposals" would label a person by what has not happened to her, which is
   * the failure the voice guide exists to prevent — so the sentence that names
   * the ordering says _personas ... quienes_, about the list, and lives on the
   * page rather than on a card.
   */
  it("names the ordering over the list and never over a person", () => {
    expect(BROWSE_LEAD).toContain("empezando por quienes");
    // The grid's own strings — the ones a card renders — say nothing about it.
    expect(photoAlt("Ana María R.").toLowerCase()).not.toMatch(/propuesta/);
  });
});

describe("the announced count", () => {
  it("says one profile in the singular", () => {
    expect(announcedCount(1)).toBe("1 perfil");
  });

  it("says the count and the plural noun, and nothing else", () => {
    expect(announcedCount(24)).toBe("24 perfiles");
  });
});

describe("the photo alt", () => {
  /**
   * It says what the image shows and nothing about her circumstances — the
   * guide bans the earthquake as a property of a person in an `alt` attribute by
   * name, and this is the attribute it names.
   */
  it("names the person and nothing else", () => {
    expect(photoAlt("Ana María R.")).toBe("Foto de Ana María R.");
  });
});
