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
  closedLine,
  MY_PROFILE_COPY,
  MY_PROFILE_LABELS,
  offerArrivedOn,
  pausedSince,
  publishedOn,
  senderName,
  waitingCount,
} from "./messages";

const DATE = new Date("2026-08-10T15:00:00Z");

/**
 * The fixed strings, and every built one at the values it is built from — a
 * sentence assembled from parts is still a sentence a person reads, and the
 * rules below have to run over what is actually rendered.
 */
const copy = [
  ...Object.entries(MY_PROFILE_COPY),
  ["PUBLISHED_ON", publishedOn(DATE)],
  ["PAUSED_SINCE", pausedSince(DATE)],
  ["WAITING_ONE", waitingCount(1)],
  ["WAITING_MANY", waitingCount(12)],
  ["OFFER_ARRIVED_ON", offerArrivedOn(DATE)],
  ["CLOSED_LINE_NAMED", closedLine("Carlos Restrepo", "Aceptada")],
  ["CLOSED_LINE_UNNAMED", closedLine(null, "Vencida")],
  ["SENDER_UNNAMED", senderName(null)],
] as [string, string][];

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

  // A promise the platform cannot make, in either construction.
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
  it.each(Object.entries(MY_PROFILE_LABELS))("%s is five words or fewer", (_name, value) => {
    expect(wordCount(value)).toBeLessThanOrEqual(LABEL_WORD_CEILING);
  });
});

describe("the date", () => {
  it("reads as a Colombian date, never as digits", () => {
    expect(publishedOn(new Date("2026-08-10T15:00:00Z"))).toBe(
      "Publicado el 10 de agosto de 2026.",
    );
  });
});

describe("the photo sentences", () => {
  // Described, never badged, and never "en revisión" applied to the profile.
  it("describe the photo, not the profile", () => {
    expect(MY_PROFILE_COPY.PHOTO_PENDING.toLowerCase()).toContain("foto");
    expect(MY_PROFILE_COPY.PHOTO_PENDING.toLowerCase()).not.toContain("perfil está en revisión");
  });
});
