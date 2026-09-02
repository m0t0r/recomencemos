/**
 * The countable half of `docs/policy/voice.md`, over every string `/publish`
 * renders — the same shape as `/sign-in`'s copy test, and for the same reason:
 * a rule you cannot fail is not a rule. What is **not** here is the boundary
 * rule — whether the care is aimed at the process rather than at the person —
 * which is a reading, and the load-bearing one.
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
import { SESSION_REQUIRED } from "@/app/_lib/session/messages";
import {
  contactDetailRefusal,
  PUBLISH_COPY,
  PUBLISH_LABELS,
  skillsChosen,
  skillsNoneMatch,
  summaryHeading,
  workHistoryLineLabel,
} from "@/app/_lib/profile-form/messages";

const copy = [
  ...Object.entries(PUBLISH_COPY),
  ["SESSION_REQUIRED", SESSION_REQUIRED],
  ["CONTACT_DETAIL_PHONE", contactDetailRefusal("phone", "300 123 4567")],
  ["CONTACT_DETAIL_EMAIL", contactDetailRefusal("email", "ana@example.co")],
  ["CONTACT_DETAIL_URL", contactDetailRefusal("messaging_url", "wa.me/573001234567")],
  ["SKILLS_NONE_MATCH", skillsNoneMatch("plom")],
  ["SKILLS_CHOSEN_ONE", skillsChosen(1)],
  ["SKILLS_CHOSEN_MANY", skillsChosen(3)],
  ["SKILLS_CHOSEN_NONE", skillsChosen(0)],
  ["SUMMARY_ONE", summaryHeading(1)],
  ["SUMMARY_MANY", summaryHeading(4)],
] as [string, string][];

const labels = [
  ...Object.entries(PUBLISH_LABELS),
  ["WORK_HISTORY_LINE", workHistoryLineLabel(2)],
] as [string, string][];

describe.each(copy)("%s", (_name, value) => {
  it("is not empty", () => {
    expect(value.trim().length).toBeGreaterThan(0);
  });

  it("has no ALL CAPS word", () => {
    expect(shoutedWords(value)).toEqual([]);
  });

  // No exclamation marks; this surface's success lives on `/my-profile`.
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

  // Never *inválido*: a refusal is our rule, not her mistake.
  it("does not call anything invalid", () => {
    expect(value.toLowerCase()).not.toContain("inválid");
  });
});

describe("body copy", () => {
  it.each(copy)("%s keeps every sentence to twenty words", (_name, value) => {
    for (const sentence of sentencesOf(value)) {
      expect(wordCount(sentence)).toBeLessThanOrEqual(SENTENCE_WORD_CEILING);
    }
  });
});

describe("labels and buttons", () => {
  it.each(labels)("%s is five words or fewer", (_name, value) => {
    expect(wordCount(value)).toBeLessThanOrEqual(LABEL_WORD_CEILING);
  });

  it("says the verb of its action on the publish button", () => {
    expect(PUBLISH_LABELS.PUBLISH_BUTTON).not.toBe("Enviar");
    expect(PUBLISH_LABELS.PUBLISH_BUTTON).not.toBe("Continuar");
    expect(PUBLISH_LABELS.PUBLISH_BUTTON.toLowerCase()).toContain("publicar");
  });
});

describe("the sentences the ticket names specifically", () => {
  // NFR12: the rejection names the fragment.
  it("quotes the fragment back in the contact-detail refusal", () => {
    expect(contactDetailRefusal("phone", "321 456 7890")).toContain("«321 456 7890»");
    expect(contactDetailRefusal("email", "ana@example.co")).toContain("«ana@example.co»");
  });

  // The seventh state and every refusal: nothing she typed was lost.
  it("says nothing was lost, in the summary and on a transport fault", () => {
    expect(PUBLISH_COPY.SUMMARY_KEPT.toLowerCase()).toContain("sigue en el formulario");
    expect(PUBLISH_COPY.PUBLISH_FAILED.toLowerCase()).toContain("se perdió");
  });

  // The disclosure rule beside the fields it governs.
  it("says beside the phone that it does not leave until she accepts", () => {
    expect(PUBLISH_COPY.CONTACT_VISIBILITY.toLowerCase()).toContain("no sale de aquí");
    expect(PUBLISH_COPY.CONTACT_VISIBILITY.toLowerCase()).toContain("aceptes");
  });

  it("says the full name is not public", () => {
    expect(PUBLISH_COPY.IDENTITY_VISIBILITY.toLowerCase()).toContain("nombre completo no");
  });

  // NFR4: the photo is the one documented exception, and the form says so.
  it("names the photo as what comes after publishing", () => {
    expect(PUBLISH_COPY.PHOTO_NOTE.toLowerCase()).toContain("foto");
    expect(PUBLISH_COPY.PHOTO_NOTE.toLowerCase()).toContain("después");
  });

  // The "not on the list" option says what happens today rather than promising.
  it("tells her what the not-listed option does today", () => {
    expect(PUBLISH_COPY.SKILL_NOT_LISTED_HELP.toLowerCase()).toContain("por ahora");
  });

  // Voice guide, Don't 5: the actor is us, and every refusal says so.
  it("names us as the ones who hand over her contact details, in every refusal", () => {
    for (const kind of ["phone", "email", "messaging_url"] as const) {
      expect(contactDetailRefusal(kind, "x").toLowerCase()).toContain("damos nosotros");
    }
  });
});
