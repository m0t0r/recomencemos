/**
 * The two sentences on this surface that are claims about the queue rather than
 * labels on it — and one rule that binds every string here.
 *
 * A label being wrong is a label being wrong. These two being wrong is an Admin
 * concluding a branch is clear when nothing is counting it, which is the
 * unreviewed Offer the whole surface exists to prevent.
 */

import {
  coverageNotice,
  OFFERS_LABEL,
  PHOTOS_LABEL,
  QUEUE_EMPTY_BODY,
  QUEUE_EMPTY_TITLE,
  SECTION_NOT_LIVE_BODY,
  SECTION_NOT_LIVE_TITLE,
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

describe("empty and not-live", () => {
  /**
   * **They are different sentences and must stay different.** Zero means
   * everything was read; not-live means nothing was ever asked. The failure this
   * guards is somebody collapsing both into a generic "no hay nada", which on a
   * moderation queue is indistinguishable from a screen that failed to load.
   */
  it("says two different things", () => {
    expect(SECTION_NOT_LIVE_TITLE).not.toBe(QUEUE_EMPTY_TITLE);
    expect(SECTION_NOT_LIVE_BODY).not.toBe(QUEUE_EMPTY_BODY);
  });

  /**
   * The empty state states the age as zero, which the acceptance criterion asks
   * for outright: _"a real and good state, saying the oldest-item age is zero"_.
   */
  it("states the age as zero where the section is empty", () => {
    expect(QUEUE_EMPTY_BODY).toContain("0 h");
  });

  /**
   * And the not-live copy states no figure at all. A zero here would be the
   * instrument that lies; this is the assertion that keeps one from being added
   * for symmetry.
   */
  it("states no figure at all where the section is not counting", () => {
    expect(SECTION_NOT_LIVE_TITLE + SECTION_NOT_LIVE_BODY).not.toMatch(/\d/);
  });
});
