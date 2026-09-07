/**
 * `/profile/[slug]`'s copy, plus the one string it borrows: the ceiling's
 * refusal, which lives with the ceiling because it quotes a count and a wait
 * this surface does not know and must not guess.
 *
 * What is **not** here is the half no test reaches: whether the care is aimed at
 * the process rather than at the person. On this surface that reading matters
 * more than on any other, because it is the one page that is *about* somebody.
 */

import { CEILING_REFUSALS } from "@repo/domain/rate-limit";
import { describeSurfaceCopy } from "@/testing/surface-copy";
import {
  ABOUT_HEADING,
  NOTHING_MORE,
  PROFILE_PAGE_TITLE,
  RATE_LIMITED_HEADING,
  TO_BROWSE,
  WORK_HISTORY_HEADING,
} from "./messages";

const HOURLY = CEILING_REFUSALS.readProfileHourly({ max: 60, windowSeconds: 3600 }, 720);
const DAILY = CEILING_REFUSALS.readProfileDaily({ max: 300, windowSeconds: 86_400 }, 7200);

describeSurfaceCopy({
  copy: [
    ["PROFILE_PAGE_TITLE", PROFILE_PAGE_TITLE],
    ["ABOUT_HEADING", ABOUT_HEADING],
    ["WORK_HISTORY_HEADING", WORK_HISTORY_HEADING],
    ["NOTHING_MORE", NOTHING_MORE],
    ["TO_BROWSE", TO_BROWSE],
    ["RATE_LIMITED_HEADING", RATE_LIMITED_HEADING],
    ["readProfileHourly", HOURLY],
    ["readProfileDaily", DAILY],
  ],
  labels: [["TO_BROWSE", TO_BROWSE]],
});

/**
 * **This page is the one surface in the product that is about a person**, so the
 * vocabulary rules `CONTEXT.md` fixes are worth asserting here rather than
 * trusting to the shared block. Every one of these names a person by an event
 * rather than by a capability, which is `docs/policy/voice.md`'s stated failure
 * mode.
 */
describe("what a profile never says about the person on it", () => {
  const everything = [
    PROFILE_PAGE_TITLE,
    ABOUT_HEADING,
    WORK_HISTORY_HEADING,
    NOTHING_MORE,
    TO_BROWSE,
    RATE_LIMITED_HEADING,
  ]
    .join(" ")
    .toLowerCase();

  it.each([
    "damnificad",
    "víctima",
    "afectad",
    "beneficiari",
    "necesitad",
    "terremoto",
    "historia",
  ])("does not say %s", (word) => {
    expect(everything).not.toContain(word);
  });

  /**
   * Story 11's two standing notices. A half-version in a heading here would give
   * them a second source, which is the one thing worse than an absent notice —
   * and this page is on their list, so the real ones arrive above her own words.
   */
  it("makes no claim about verification", () => {
    expect(everything).not.toMatch(/verifica/);
  });

  it("makes no claim about money", () => {
    expect(everything).not.toMatch(/\b(dinero|pagos|plata|comisión)\b/);
  });
});

/**
 * NFR9 read from the copy's end. The slug is opaque so that the address carries
 * no identity; a document title carrying her name would put it back — in the
 * browser tab, in the history, and in whatever the operating system shares from
 * a tab.
 */
describe("the document title", () => {
  it("is the same on every profile, so it confirms nothing about a slug", () => {
    expect(PROFILE_PAGE_TITLE).not.toMatch(/\$\{|%s/);
  });

  it("names the product and not a person", () => {
    expect(PROFILE_PAGE_TITLE).toContain("Recomencemos");
  });
});

/**
 * The seventh state's copy is the ceiling's, and NFR26's third half is what it
 * has to satisfy: the count he spent, and when it reopens. Asserted here as well
 * as in `@repo/domain` because this is the surface that renders it, and a
 * refusal that quoted no number would be the silence C39 exists to close.
 */
describe("the refusal a reader meets at the ceiling", () => {
  it("quotes the hourly count and says when reading resumes", () => {
    expect(HOURLY).toContain("60");
    expect(HOURLY).toContain("12 minutos");
  });

  it("quotes the daily count and says when reading resumes", () => {
    expect(DAILY).toContain("300");
    expect(DAILY).toContain("2 horas");
  });

  it("names the lists, which carry no ceiling and are still open", () => {
    for (const refusal of [HOURLY, DAILY]) {
      expect(refusal).toContain("listas");
    }
  });

  /**
   * It is a rate, not a sanction. A refusal that called him blocked would
   * describe a person by a rule that is about how fast he read.
   */
  it("never calls him blocked", () => {
    for (const refusal of [HOURLY, DAILY, RATE_LIMITED_HEADING]) {
      expect(refusal.toLowerCase()).not.toMatch(/bloque|suspend|sanci/);
    }
  });
});
