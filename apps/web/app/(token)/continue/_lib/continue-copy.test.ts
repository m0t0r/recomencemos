/**
 * The countable half of `docs/policy/voice.md`, over every string the
 * second-factor screen renders.
 *
 * The rules that are mechanical run here; the half no test can reach — whether
 * the care is aimed at the process rather than at the person — is a reading, and
 * on this surface there is very little of it to do: the tone matrix puts Admin
 * surfaces at Warmth 5→2, and nothing here describes the reader at all.
 *
 * What is specific to this surface is the last block. Three of its acceptance
 * criteria are properties of *sentences* rather than of behaviour — that the
 * description names both credentials, that nothing names the surface behind this
 * one, and that no string here is a spec identifier — so they are checked where
 * the sentences are.
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
import { CODE_DESCRIPTION, CONTINUE_COPY, CONTINUE_LABELS, SUBMIT_BUTTON } from "./messages";

const copy = Object.entries(CONTINUE_COPY);
const labels = Object.entries(CONTINUE_LABELS);

describe.each(copy)("%s", (_name, value) => {
  it("is not empty", () => {
    expect(value.trim().length).toBeGreaterThan(0);
  });

  // Some screen readers spell them out, and it reads as shouting.
  it("has no ALL CAPS word", () => {
    expect(shoutedWords(value)).toEqual([]);
  });

  // The one permitted exception is a success state, and this surface has none:
  // success here is a redirect, so nothing on this screen is ever a celebration.
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
});

describe("body copy", () => {
  it.each(copy)("%s keeps every sentence to twenty words", (_name, value) => {
    const sentences = sentencesOf(value);

    expect(sentences.length).toBeGreaterThan(0);
    for (const sentence of sentences) {
      expect(wordCount(sentence)).toBeLessThanOrEqual(SENTENCE_WORD_CEILING);
    }
  });
});

describe("labels and buttons", () => {
  it.each(labels)("%s is five words or fewer", (_name, value) => {
    expect(wordCount(value)).toBeLessThanOrEqual(LABEL_WORD_CEILING);
  });

  /**
   * A button says the verb of its action. One word is right here and would be
   * wrong on `/sign-in`: this screen has one control and one outcome, so the
   * verb alone is unambiguous — but it still may not be the two verbs that name
   * no action at all.
   */
  it("is not a bare Enviar or Continuar", () => {
    expect(SUBMIT_BUTTON).not.toBe("Enviar");
    expect(SUBMIT_BUTTON).not.toBe("Continuar");
  });
});

describe("the sentences this ticket names specifically", () => {
  /**
   * **The recovery path has to be named on screen or it does not exist.** DD5's
   * ten printed codes are useless if nothing here says they work in this box:
   * somebody whose phone is gone meets no lockout message and no error, just a
   * field with nothing obvious to type. This is the assertion that the one line
   * rescuing them is still there.
   */
  it("names both credentials in the field's description", () => {
    expect(CODE_DESCRIPTION).toContain("seis dígitos");
    expect(CODE_DESCRIPTION).toContain("códigos de respaldo");
  });

  /**
   * **Nothing on this surface names the surface behind it**, in the heading, the
   * tab title or anywhere else. A door that advertises the other door undoes the
   * reason the other door has no page of its own — and the tab title is the one
   * string that survives into a screenshot and a browser's history.
   */
  it.each(copy)("%s says nothing about the surface behind this one", (_name, value) => {
    const said = value.toLowerCase();

    for (const word of ["admin", "moderaci", "panel", "/admin"]) {
      expect(said).not.toContain(word);
    }
  });

  /**
   * **No address on screen, masked, partial or otherwise.** It would confirm
   * which Account a stolen link belongs to. There is nothing here to interpolate
   * one into, and this is what says a later edit did not add one.
   */
  it.each(copy)("%s carries no address and no interpolation", (_name, value) => {
    expect(value).not.toContain("@");
    expect(value).not.toContain("${");
  });

  /**
   * **No spec identifier in any string a person reads.** `pnpm spec-identifiers`
   * is the repo-wide gate; this is the same rule asserted where this surface's
   * strings actually live, because the gate cannot judge whether a sentence
   * that replaced a citation says the substance.
   */
  it.each(copy)("%s cites no requirement, decision or ticket", (_name, value) => {
    expect(value).not.toMatch(/\b(?:NFR|ADR|DD|C)\d+\b/);
    expect(value).not.toMatch(/#\d+/);
  });
});
