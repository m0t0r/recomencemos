/**
 * The countable half of `docs/policy/voice.md` over every string
 * `/my-profile/edit` renders **of its own** — the same shape as `/publish`'s
 * and `/my-profile`'s copy tests, and for the same reason: a rule you cannot
 * fail is not a rule.
 *
 * The field labels, help lines and refusals are not here because they are not
 * this surface's: they live in `@/app/_lib/profile-form/messages` and
 * `publish-copy.test.ts` already reads every one of them. What is here is the
 * six strings that exist only on this page.
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
import { EDIT_COPY, EDIT_LABELS, EDIT_PAGE_TITLE } from "./messages";

const copy = [...Object.entries(EDIT_COPY), ["EDIT_PAGE_TITLE", EDIT_PAGE_TITLE]] as [
  string,
  string,
][];

describe.each(copy)("%s", (_name, value) => {
  it("is not empty", () => {
    expect(value.trim().length).toBeGreaterThan(0);
  });

  it("has no ALL CAPS word", () => {
    expect(shoutedWords(value)).toEqual([]);
  });

  // No exclamation marks: the success this form produces is read on
  // `/my-profile`, and nothing here is a celebration.
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
  it.each(Object.entries(EDIT_LABELS))("%s is five words or fewer", (_name, value) => {
    expect(wordCount(value)).toBeLessThanOrEqual(LABEL_WORD_CEILING);
  });

  /**
   * Leaving drops what she has typed since her last save and nothing prompts
   * her, so the way out says so — that is the half of the link text that
   * survived the five-word ceiling.
   */
  it("says on the way out that leaving does not save", () => {
    expect(EDIT_LABELS.BACK_TO_PROFILE.toLowerCase()).toContain("sin guardar");
  });

  // The verb on the control is the verb of the act, as the publish button's is.
  it("says the verb of its action on the save button", () => {
    expect(EDIT_LABELS.SAVE_BUTTON).not.toBe("Enviar");
    expect(EDIT_LABELS.SAVE_BUTTON).not.toBe("Continuar");
    expect(EDIT_LABELS.SAVE_BUTTON.toLowerCase()).toContain("guardar");
  });
});

describe("the sentences this surface is judged on", () => {
  /**
   * The address a Hirer already holds keeps resolving, and the intro is where
   * she is told so. It is the reassurance the stable slug exists to make true.
   */
  it("says the link to her profile does not change", () => {
    expect(EDIT_COPY.EDIT_INTRO.toLowerCase()).toContain("enlace");
    expect(EDIT_COPY.EDIT_INTRO.toLowerCase()).toContain("el mismo");
  });

  /**
   * **Nothing on this surface mentions the Wall.** An edit does not move her
   * position on it — that is the site keeping a promise to everyone else — and
   * saying so would teach a Worker that moving up is something this site does.
   */
  it("says nothing about the Wall or about position on it", () => {
    for (const value of Object.values({ ...EDIT_COPY, ...EDIT_LABELS })) {
      expect(value.toLowerCase()).not.toContain("muro");
      expect(value.toLowerCase()).not.toContain("primero");
      expect(value.toLowerCase()).not.toContain("arriba");
    }
  });

  /**
   * **The photo sentence names no place, because there is not one yet.**
   * Swapping a photo ships separately, and a sentence pointing at a control
   * that does not exist is the failure this surface already had to repair once
   * in the Skill request's copy.
   */
  it("says only that the photo is not changed from here", () => {
    expect(EDIT_COPY.PHOTO_CHANGED_ELSEWHERE.toLowerCase()).toContain("foto");
    expect(EDIT_COPY.PHOTO_CHANGED_ELSEWHERE.toLowerCase()).toContain("no se cambia");
    expect(EDIT_COPY.PHOTO_CHANGED_ELSEWHERE.toLowerCase()).not.toContain("perfil");
  });

  // A transport fault says what failed, that nothing was lost, and that
  // retrying helps — never that she did something wrong.
  it("says nothing was lost on a transport fault", () => {
    expect(EDIT_COPY.SAVE_FAILED.toLowerCase()).toContain("se perdió");
    expect(EDIT_COPY.SAVE_FAILED.toLowerCase()).toContain("de nuevo");
  });
});
