/**
 * Seam 1 over the consent registry — pure, so the whole of it is a return value.
 *
 * The one behaviour worth the most here is {@link versionsAreCurrent}'s refusal.
 * It is the guard against a row that records an authorization to text the person
 * never read, and that row is indistinguishable from a correct one afterwards:
 * every column is populated, every value is plausible, and only the clock knows.
 */

import {
  CONSENT_AUTHORIZATION_VERSIONS,
  CONSENT_NOTICE_VERSIONS,
  CONSENT_SIDES,
  CURRENT_AUTHORIZATION_VERSION,
  CURRENT_CONSENT_VERSIONS,
  CURRENT_NOTICE_VERSION,
  versionsAreCurrent,
} from "#consent/registry";

describe("the sides", () => {
  // The spec's Core entities fixes both, and the second is the one the draft
  // missed: the platform collects and discloses a Hirer's name, phone and email
  // too, and he was consenting to nothing.
  it("is the Worker at publish and the Hirer at first Offer send", () => {
    expect([...CONSENT_SIDES]).toEqual(["worker", "hirer"]);
  });

  // ADR-0012: every identifier is English, and this set reaches a CHECK
  // constraint, where `inList` refuses anything that is not one.
  it.each([...CONSENT_SIDES])("%s is an English identifier", (side) => {
    expect(side).toMatch(/^[a-z][a-z0-9_]*$/);
  });
});

describe("the versions in force", () => {
  // The invariant the whole registry rests on. A current version absent from its
  // own history is a row nobody can explain, which is the state this shape makes
  // unreachable rather than merely unlikely.
  it("is the last entry of the notice history", () => {
    expect(CONSENT_NOTICE_VERSIONS).toContain(CURRENT_NOTICE_VERSION);
    expect(CONSENT_NOTICE_VERSIONS.at(-1)).toBe(CURRENT_NOTICE_VERSION);
  });

  it("is the last entry of the authorization history", () => {
    expect(CONSENT_AUTHORIZATION_VERSIONS).toContain(CURRENT_AUTHORIZATION_VERSION);
    expect(CONSENT_AUTHORIZATION_VERSIONS.at(-1)).toBe(CURRENT_AUTHORIZATION_VERSION);
  });

  it("carries both halves in one object, so a caller cannot take one and forget the other", () => {
    expect(CURRENT_CONSENT_VERSIONS).toEqual({
      notice: CURRENT_NOTICE_VERSION,
      authorization: CURRENT_AUTHORIZATION_VERSION,
    });
  });

  // A version is a date because the row has to point at text somebody can read
  // back. Nothing downstream parses it; the shape is checked so that a version
  // appended by hand as `v2` is caught here rather than in an export a year later.
  it.each([...CONSENT_NOTICE_VERSIONS, ...CONSENT_AUTHORIZATION_VERSIONS])(
    "%s is a calendar date",
    (version) => {
      expect(version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(version))).toBe(false);
    },
  );
});

describe("versionsAreCurrent", () => {
  it("accepts the pair a form displays today", () => {
    expect(versionsAreCurrent(CURRENT_CONSENT_VERSIONS)).toBe(true);
  });

  // She opened the form, read the text, and left the tab open while it changed.
  // Both halves are checked independently because they version apart: a processor
  // added to the notice is not a change to what she was asked to authorize, and
  // vice versa.
  it("refuses a stale notice version", () => {
    expect(
      versionsAreCurrent({
        notice: "2020-01-01",
        authorization: CURRENT_AUTHORIZATION_VERSION,
      }),
    ).toBe(false);
  });

  it("refuses a stale authorization version", () => {
    expect(
      versionsAreCurrent({
        notice: CURRENT_NOTICE_VERSION,
        authorization: "2020-01-01",
      }),
    ).toBe(false);
  });

  // A version nobody published is the same refusal as a stale one — the row would
  // point at text that does not exist, which answers a reclamo no better.
  it.each(["", "latest", "2999-12-31"])("refuses %o as a notice version", (notice) => {
    expect(versionsAreCurrent({ notice, authorization: CURRENT_AUTHORIZATION_VERSION })).toBe(
      false,
    );
  });
});
