/**
 * @vitest-environment node
 *
 * `/profile/[slug]`'s copy, plus the one string it borrows: the ceiling's
 * refusal, which lives with the ceiling because it quotes a count and a wait
 * this surface does not know and must not guess.
 *
 * What is **not** here is the half no test reaches: whether the care is aimed at
 * the process rather than at the person. On this surface that reading matters
 * more than on any other, because it is the one page that is *about* somebody.
 *
 * **A Node environment, because the borrowed string comes from
 * `@repo/domain/rate-limit`**, which imports the pooled connection — a package
 * that refuses to load where a `window` exists. Every assertion here is over
 * strings.
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

/**
 * **Both scopes, because this surface renders whichever one refused.**
 * `chargeCeilings` charges the Account and the address, and hands the page the
 * first refusal's sentence whichever principal it belonged to — so the per-IP
 * half is copy a person reads here just as much as the per-Account half, and the
 * voice rules have to run over it. It is the half that used to quote her a count
 * that was not hers.
 */
const HOURLY = CEILING_REFUSALS.readProfileHourly({ max: 60, windowSeconds: 3600 }, 720, "account");
const HOURLY_SHARED = CEILING_REFUSALS.readProfileHourly(
  { max: 300, windowSeconds: 3600 },
  720,
  "ip",
);
const DAILY = CEILING_REFUSALS.readProfileDaily(
  { max: 300, windowSeconds: 86_400 },
  7200,
  "account",
);
const DAILY_SHARED = CEILING_REFUSALS.readProfileDaily(
  { max: 1500, windowSeconds: 86_400 },
  7200,
  "ip",
);

describeSurfaceCopy({
  copy: [
    ["PROFILE_PAGE_TITLE", PROFILE_PAGE_TITLE],
    ["ABOUT_HEADING", ABOUT_HEADING],
    ["WORK_HISTORY_HEADING", WORK_HISTORY_HEADING],
    ["NOTHING_MORE", NOTHING_MORE],
    ["TO_BROWSE", TO_BROWSE],
    ["RATE_LIMITED_HEADING", RATE_LIMITED_HEADING],
    ["readProfileHourly", HOURLY],
    ["readProfileHourly · shared connection", HOURLY_SHARED],
    ["readProfileDaily", DAILY],
    ["readProfileDaily · shared connection", DAILY_SHARED],
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

  /**
   * It said `"las listas"` and named nothing anybody had seen. The two surfaces
   * that carry no ceiling are *el muro* — the Wall's Spanish, fixed in
   * `CONTEXT.md` — and the browsable list, which its own empty state already
   * calls *la lista*.
   */
  it("names the two surfaces that carry no ceiling, as the product names them", () => {
    for (const refusal of [HOURLY, HOURLY_SHARED, DAILY, DAILY_SHARED]) {
      expect(refusal).toContain("el muro");
      expect(refusal).toContain("la lista de perfiles");
    }
  });

  /**
   * **The count belongs to one principal and the sentence has to know which.**
   * A shared connection is not a person, so quoting it a maximum says "you did
   * this" about somebody else — a reader on a café's wifi who opened five
   * profiles was told she had opened 300.
   */
  it("quotes no ceiling's count to a shared connection", () => {
    for (const refusal of [HOURLY_SHARED, DAILY_SHARED]) {
      // Every maximum in play on this route, per-Account and per-IP, hourly and
      // daily. The wait is still a number and is still hers to read.
      for (const max of ["60", "300", "1500"]) {
        expect(refusal).not.toContain(max);
      }

      expect(refusal).toContain("conexión a internet");
    }
  });

  it("still says when reading resumes, whichever principal refused", () => {
    expect(HOURLY_SHARED).toContain("12 minutos");
    expect(DAILY_SHARED).toContain("2 horas");
  });

  /**
   * It is a rate, not a sanction. A refusal that called him blocked would
   * describe a person by a rule that is about how fast he read.
   */
  it("never calls him blocked", () => {
    for (const refusal of [HOURLY, HOURLY_SHARED, DAILY, DAILY_SHARED, RATE_LIMITED_HEADING]) {
      expect(refusal.toLowerCase()).not.toMatch(/bloque|suspend|sanci/);
    }
  });
});
