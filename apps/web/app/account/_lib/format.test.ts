/**
 * The dates and times `/account` renders, pinned to Bogotá and to the voice
 * guide's formats.
 *
 * **The timezone cases are the reason this file exists.** The server runs in UTC
 * and the reader is in Risaralda, five hours behind — so every assertion here
 * uses an instant that falls on a *different calendar day* in the two zones. A
 * test written with a midday instant passes under either implementation and
 * proves nothing.
 */

import { atTime, expiresLabel, onDate, startedLabel } from "./format";

/**
 * **The space inside `p. m.` is a no-break space, and that is correct rather
 * than incidental.** ICU follows the RAE here, which prescribes U+00A0 between
 * the two letters so a line break cannot split the abbreviation. The voice guide
 * asks for "the periods and the space" and this is that space; spelled as an
 * escape so the assertion cannot be "fixed" by typing an ordinary one.
 */
const PM = "p.\u00A0m.";
const AM = "a.\u00A0m.";

/** 27 September 2026, 8:40 p.m. in Pereira — which is 01:40 UTC on the 28th. */
const EVENING = new Date("2026-09-28T01:40:00Z");

describe("es-CO formats", () => {
  it("writes a date the way the voice guide fixes it, in Bogotá's day", () => {
    // Not "28 de septiembre", which is what UTC would say about this instant.
    expect(onDate(EVENING)).toBe("27 de septiembre");
  });

  it("writes a 12-hour time with the periods and the space", () => {
    expect(atTime(EVENING)).toBe(`8:40 ${PM}`);
  });
});

describe("startedLabel", () => {
  it("says hoy for a session started earlier the same day in Bogotá", () => {
    const morning = new Date("2026-09-27T14:00:00Z"); // 9 a.m. in Pereira
    expect(startedLabel(morning, EVENING)).toBe("hoy");
  });

  /**
   * The case a 24-hour subtraction gets wrong: 22 hours apart, but two different
   * days in Pereira.
   */
  it("says ayer across a calendar boundary, not across 24 hours", () => {
    const lastNight = new Date("2026-09-27T03:40:00Z"); // 10:40 p.m. on the 26th
    expect(startedLabel(lastNight, EVENING)).toBe("ayer");
  });

  it("counts days while a count is still the useful answer", () => {
    // 9 a.m. on the 21st in Pereira; EVENING is the evening of the 27th.
    const sixDaysAgo = new Date("2026-09-21T14:00:00Z");
    expect(startedLabel(sixDaysAgo, EVENING)).toBe("hace 6 días");
  });

  it("switches to a date once a count stops being useful", () => {
    const longAgo = new Date("2026-09-08T14:00:00Z");
    expect(startedLabel(longAgo, EVENING)).toBe("el 8 de septiembre");
  });

  /**
   * Clock skew between the row's `created_at` and the reader's request is real,
   * and a negative count must not render as "hace -1 días".
   */
  it("says hoy rather than a negative count when the row is a moment ahead", () => {
    const slightlyAhead = new Date(EVENING.getTime() + 2000);
    expect(startedLabel(slightlyAhead, EVENING)).toBe("hoy");
  });
});

describe("expiresLabel", () => {
  /**
   * **The shared-device case, which is the one that matters.** An 8-hour session
   * ends the same evening, and NFR13 made her that promise at sign-in — so the
   * hour is said, not rounded away into "hoy".
   */
  it("names the hour for a session ending today", () => {
    const inTwoHours = new Date("2026-09-28T03:40:00Z"); // 10:40 p.m. in Pereira
    expect(expiresLabel(inTwoHours, EVENING)).toBe(`se cierra hoy a las 10:40 ${PM}`);
  });

  it("names the hour for a session ending tomorrow", () => {
    const tomorrowMorning = new Date("2026-09-28T13:00:00Z"); // 8 a.m. on the 28th
    expect(expiresLabel(tomorrowMorning, EVENING)).toBe(`se cierra mañana a las 8:00 ${AM}`);
  });

  it("names the date for the thirty-day own-device session", () => {
    const inThirtyDays = new Date("2026-10-27T14:00:00Z");
    expect(expiresLabel(inThirtyDays, EVENING)).toBe("se cierra el 27 de octubre");
  });
});
