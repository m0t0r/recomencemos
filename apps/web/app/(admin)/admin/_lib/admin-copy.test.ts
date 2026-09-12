/**
 * @vitest-environment node
 *
 * The two sentences on this surface that are claims about the queue rather than
 * labels on it — and one rule that binds every string here.
 *
 * A label being wrong is a label being wrong. These two being wrong is an Admin
 * concluding a branch is clear when nothing is counting it, which is the
 * unreviewed Offer the whole surface exists to prevent.
 *
 * **A Node environment, because `./messages` reaches the queue sources** and
 * those bind domain facades, which import the pooled connection — a package that
 * refuses to load where a `window` exists. Every assertion here is over strings.
 */

import {
  EMPTY_LINK_TEXT,
  NEVER_SAY,
  sentencesOf,
  SENTENCE_WORD_CEILING,
  shoutedWords,
  wordCount,
} from "@/testing/voice";
import * as messages from "./messages";

/**
 * Proper nouns that are capitalised in the world rather than by us. See the
 * ALL-CAPS case below.
 */
const ACRONYMS = new Set(["CUOC"]);
import {
  coverageNotice,
  OFFERS_LABEL,
  PHOTOS_LABEL,
  PHOTO_REJECT_WARNING,
  PHOTO_REJECTED,
  QUEUE_EMPTY_BODY,
  SKILL_REQUESTS_LABEL,
} from "./messages";
import { liveSources, pendingSources } from "./queue-sources";

describe("the coverage line", () => {
  /**
   * **It names which sources are live**, which is the acceptance criterion in as
   * many words: a shell that silently reported four of five would be an instrument
   * that lies. Both halves are named — what is counted and what is not — because
   * "some sections are missing" is a sentence an Admin cannot act on.
   */
  it("names the sections that are counting and the ones that are not", () => {
    const notice = coverageNotice([SKILL_REQUESTS_LABEL], [OFFERS_LABEL, PHOTOS_LABEL]);

    expect(notice).toContain(SKILL_REQUESTS_LABEL);
    expect(notice).toContain(OFFERS_LABEL);
    expect(notice).toContain(PHOTOS_LABEL);
  });

  /**
   * Spanish joins its last item with _y_, and `Intl.ListFormat` is what knows
   * that — including the _e_ before a word starting with the *i* sound, which a
   * hand-rolled join would get wrong the first time a section is named
   * _Imágenes_.
   */
  it("joins the names the way Spanish joins them", () => {
    expect(coverageNotice(["Fotos"], ["Reportes", "Propuestas"])).toContain(
      "Reportes y Propuestas",
    );
  });

  /**
   * **The line describes the registry it is rendered beside**, so this is the
   * case that fails on the day a resolver lands and the sentence is not updated —
   * which is the day it would start lying in the other direction.
   */
  it("describes the registry as it actually stands", () => {
    const notice = coverageNotice(
      liveSources().map((source) => source.label),
      pendingSources().map((source) => source.label),
    );

    for (const source of liveSources()) expect(notice).toContain(source.label);
    for (const source of pendingSources()) expect(notice).toContain(source.label);
  });
});

describe("the empty queue", () => {
  /**
   * The empty state states the age as zero, which the acceptance criterion asks
   * for outright: _"a real and good state, saying the oldest-item age is zero"_.
   *
   * **A source with no resolver is not the empty state**, and it has no card of
   * its own: the coverage line above says it is not counting and states no figure
   * for it, which is what keeps a zero from being reported for a branch nobody
   * asked.
   */
  it("states the age as zero when nothing is waiting", () => {
    expect(QUEUE_EMPTY_BODY).toContain("0 h");
  });
});

/**
 * **The voice guide binds this surface too, and until now nothing checked it.**
 *
 * `messages.ts` opens by saying so in as many words -- "The Admin is a person and
 * `docs/policy/voice.md` binds this file too... a rule you cannot fail is not a
 * rule" -- and then this was the only copy suite in `apps/web` running neither
 * `@/testing/voice` nor `@/testing/surface-copy`, against twelve that do. Eleven
 * strings arrived with the photo queue and met no ceiling, no `NEVER_SAY`, and
 * no ALL-CAPS check. Two copy defects shipped through the gap: a passive hiding
 * who deleted the photo, and a sentence asserting the Worker's gender on the one
 * row designed to name nobody.
 *
 * **It reads the module's own exports rather than a hand-kept aggregate**, which
 * is a deliberate departure from `my-profile-copy.test.ts`'s shape. An aggregate
 * is a second list to remember, and forgetting it is exactly how eleven strings
 * went unchecked; a namespace import cannot be forgotten, so a string added here
 * tomorrow is covered the moment it is written. The `typeof` filter is what
 * skips the builders -- `coverageNotice`, `waitingInQueue`, `photoWaitingSince`
 * and the rest -- each of which has cases of its own above and below.
 */
const strings = Object.entries<unknown>(messages).filter(
  (entry): entry is [string, string] => typeof entry[1] === "string",
);

describe.each(strings)("%s", (_name, value) => {
  it("is not empty", () => {
    expect(value.trim().length).toBeGreaterThan(0);
  });

  /**
   * **The acronym is not shouting, and the difference is worth stating.**
   * `shoutedWords` flags any run of two or more capitals, which is right for
   * emphasis and wrong for a proper noun: CUOC is Colombia's occupational
   * classification, named in the law rather than by us, and lowercasing it would
   * make the field harder to recognise for the one person who has to fill it in.
   * It is allowed by name so the check keeps its teeth everywhere else.
   */
  it("has no ALL CAPS word", () => {
    expect(shoutedWords(value).filter((word) => !ACRONYMS.has(word))).toEqual([]);
  });

  it("carries no exclamation mark", () => {
    expect(value).not.toContain("!");
    expect(value).not.toContain("\u00a1");
  });

  it.each(NEVER_SAY)("does not say %o", (banned) => {
    expect(value.toLowerCase()).not.toContain(banned);
  });

  it.each(EMPTY_LINK_TEXT)("does not say %o", (phrase) => {
    expect(value.toLowerCase()).not.toContain(phrase);
  });

  it("keeps every sentence to twenty words", () => {
    for (const sentence of sentencesOf(value)) {
      expect(wordCount(sentence)).toBeLessThanOrEqual(SENTENCE_WORD_CEILING);
    }
  });
});

/**
 * The two photo strings that shipped wrong, pinned as themselves rather than as
 * a new repo-wide rule.
 *
 * A regex banning `ella` or `se borra` across this whole file was written first
 * and then taken out: it fired on `PROMOTE_LABEL_HELP`'s "como lo diría ella",
 * which is pre-existing copy on another section and not this change's to
 * rewrite. Inventing two repo-wide copy rules is a decision for whoever owns
 * `docs/policy/voice.md`, and it is raised in the pull request rather than
 * smuggled in behind a photo fix.
 */
describe("the photo decisions say who acted, and name nobody", () => {
  it("says we delete the photo rather than that it gets deleted", () => {
    // voice.md: "Don't use the passive to hide who acted, especially when the
    // actor is us." `la foto se borra` shipped one constant away from
    // `Borramos la foto`, which is the same act said correctly.
    expect(PHOTO_REJECT_WARNING).toContain("borramos");
    expect(PHOTO_REJECT_WARNING).not.toMatch(/\bse borra\b/);
  });

  it("does not assert the Worker's gender", () => {
    // The queue names nobody and shows no fact about the person behind a row --
    // a rule this section states three times -- and gender is such a fact.
    // voice.md handles it by rephrasing, not by slashes.
    expect(PHOTO_REJECTED).not.toMatch(/\bella\b/i);
  });
});
