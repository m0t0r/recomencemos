/**
 * NFR10, as a test: one fixture carrying five distinct sentinels, three
 * assertions counting occurrences. This is what makes ADR-0003 enforceable —
 * a field added to the entity reaches a projection only by being written into
 * it, and this file is where that would be noticed.
 *
 * Counting is over the serialised output, deliberately: the question is what
 * crosses a boundary, and a boundary is a serializer.
 */

import {
  type ProfileRecord,
  toContactExchange,
  toExchangedContact,
  toExchangedProfile,
  toGatedIdentity,
  toGatedProfile,
  toOwnProfile,
  toPublicProfile,
} from "#projections";

const SENTINELS = {
  fullName: "SENTINEL_FULL_NAME",
  phone: "SENTINEL_PHONE",
  email: "SENTINEL_EMAIL",
  about: "SENTINEL_ABOUT",
  workHistory: "SENTINEL_WORK_HISTORY",
} as const;

const PHOTO_URL = "SENTINEL_PHOTO_URL";

const record: ProfileRecord = {
  slug: "k7m2p9q4w3x8y1z6",
  fullName: SENTINELS.fullName,
  firstName: "Ana",
  lastInitial: "R",
  city: "pereira",
  headline: "Cocino almuerzos para eventos",
  about: SENTINELS.about,
  phone: SENTINELS.phone,
  email: SENTINELS.email,
  photoState: "pending",
  photoUrl: PHOTO_URL,
  skills: [{ slug: "home-cooking", labelEs: "Cocinar almuerzos y comida casera" }],
  workHistory: [SENTINELS.workHistory, "Diez años en una panadería"],
  publishedAt: new Date("2026-09-02T12:00:00Z"),
};

function count(output: unknown, sentinel: string): number {
  return JSON.stringify(output).split(sentinel).length - 1;
}

function counts(output: unknown): Record<keyof typeof SENTINELS, number> {
  return {
    fullName: count(output, SENTINELS.fullName),
    phone: count(output, SENTINELS.phone),
    email: count(output, SENTINELS.email),
    about: count(output, SENTINELS.about),
    workHistory: count(output, SENTINELS.workHistory),
  };
}

describe("the public projection", () => {
  it("carries none of the five sentinels", () => {
    expect(counts(toPublicProfile(record))).toEqual({
      fullName: 0,
      phone: 0,
      email: 0,
      about: 0,
      workHistory: 0,
    });
  });

  it("carries exactly the contract's keys", () => {
    expect(Object.keys(toPublicProfile(record)).toSorted()).toEqual(
      [
        "city",
        "firstName",
        "headline",
        "lastInitial",
        "photoUrl",
        "publishedAt",
        "skills",
        "slug",
      ].toSorted(),
    );
  });

  it("withholds a photo that is not approved", () => {
    expect(toPublicProfile(record).photoUrl).toBeNull();
    expect(count(toPublicProfile(record), PHOTO_URL)).toBe(0);
  });

  it("carries an approved photo", () => {
    expect(toPublicProfile({ ...record, photoState: "approved" }).photoUrl).toBe(PHOTO_URL);
  });
});

describe("the gated projection", () => {
  it("carries the self-description and the work history, and none of the other three", () => {
    expect(counts(toGatedProfile(record))).toEqual({
      fullName: 0,
      phone: 0,
      email: 0,
      about: 1,
      workHistory: 1,
    });
  });

  it("still withholds an unapproved photo", () => {
    expect(toGatedProfile(record).photoUrl).toBeNull();
  });

  /**
   * **The half that streams is counted separately**, because it is the half a
   * reader is most likely to widen: it is what `/profile/[slug]` renders before
   * the work history resolves, so a field appended to it reaches the browser
   * first and is the last thing anyone re-reads.
   */
  describe("its first half, which streams before the work history", () => {
    it("carries the self-description and none of the other four", () => {
      expect(counts(toGatedIdentity(record))).toEqual({
        fullName: 0,
        phone: 0,
        email: 0,
        about: 1,
        workHistory: 0,
      });
    });

    it("carries exactly the public keys plus the self-description", () => {
      expect(Object.keys(toGatedIdentity(record)).toSorted()).toEqual(
        [...Object.keys(toPublicProfile(record)), "about"].toSorted(),
      );
    });

    /**
     * The whole projection is its first half plus the history and nothing else.
     * Asserted rather than assumed, so the two cannot drift into two whitelists
     * that disagree about what "gated" means.
     */
    it("is the whole gated shape minus the work history", () => {
      const { workHistory, ...rest } = toGatedProfile(record);

      expect(rest).toEqual(toGatedIdentity(record));
      expect(workHistory).toEqual(record.workHistory);
    });
  });
});

describe("the exchanged projection", () => {
  it("carries all five", () => {
    expect(counts(toExchangedProfile(record))).toEqual({
      fullName: 1,
      phone: 1,
      email: 1,
      about: 1,
      workHistory: 1,
    });
  });

  it("is reachable only as the three contact fields, nothing more, on its own", () => {
    expect(toExchangedContact(record)).toEqual({
      fullName: SENTINELS.fullName,
      phone: SENTINELS.phone,
      email: SENTINELS.email,
    });
  });
});

/** Where her profile stands: paused, and not taken down. Hers alone to read. */
const STANDING = { pausedAt: new Date("2026-09-11T14:00:00Z"), takenDown: false } as const;

/**
 * **What reaches his screen at exchange, counted with the same five sentinels.**
 * He already holds her self-description and work history from the gated read;
 * the exchange view is the other half of the exchanged projection, and it
 * carries her three held details and neither of the gated two — so the two
 * reads together are the five, and neither alone is.
 */
describe("the Contact Exchange, as he reads it", () => {
  it("carries her three held details and neither of the gated two", () => {
    const view = toContactExchange(
      {
        offerId: "0199a1f0-2b3c-7def-8000-0123456789ab",
        exchangedAt: new Date("2026-09-12T15:00:00Z"),
        worker: { fullName: SENTINELS.fullName, phone: SENTINELS.phone, email: SENTINELS.email },
        hirer: { fullName: "Carlos Restrepo", phone: null, email: "carlos@recomencemos.test" },
        workerCopy: "sent",
        hirerCopy: "sent",
      },
      "hirer",
    );

    expect(counts(view)).toEqual({ fullName: 1, phone: 1, email: 1, about: 0, workHistory: 0 });
  });
});

describe("her own projection", () => {
  it("carries all five, her photo state, and her photo whatever its state", () => {
    const own = toOwnProfile(record, STANDING);

    expect(counts(own)).toEqual({ fullName: 1, phone: 1, email: 1, about: 1, workHistory: 1 });
    expect(own.photoState).toBe("pending");
    expect(own.photoUrl).toBe(PHOTO_URL);
  });

  it("carries when she paused and whether it is taken down", () => {
    expect(toOwnProfile(record, STANDING)).toMatchObject(STANDING);
  });

  // A paused profile is never served to anyone else, so neither shape may
  // learn to carry the fact — the record they read does not even hold it.
  it.each([
    ["public", toPublicProfile],
    ["gated", toGatedProfile],
  ])("the %s shape carries neither", (_name, project) => {
    const output = project(record);

    expect("pausedAt" in output).toBe(false);
    expect("takenDown" in output).toBe(false);
  });
});

describe("every projection", () => {
  it.each([
    ["public", toPublicProfile],
    ["gated identity", toGatedIdentity],
    ["gated", toGatedProfile],
    ["exchanged", toExchangedProfile],
    ["own", (from: typeof record) => toOwnProfile(from, STANDING)],
  ])("%s defines no toJSON and is a plain object", (_name, project) => {
    const output = project(record);

    expect(Object.getPrototypeOf(output)).toBe(Object.prototype);
    expect("toJSON" in output).toBe(false);
  });

  it("does not share the record's arrays, so a caller cannot reach back into it", () => {
    const gated = toGatedProfile(record);

    expect(gated.skills).not.toBe(record.skills);
    expect(gated.workHistory).not.toBe(record.workHistory);
  });
});
