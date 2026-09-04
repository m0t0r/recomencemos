/**
 * C24's threshold, which is the only arithmetic in the platform signal.
 *
 * Pure, so it is tested here rather than at seam 3: whether eleven publishes in
 * an hour is worth saying out loud is a decision this screen makes, and the
 * domain's `countPublishedSince` — tested at seam 2 against the committed
 * migrations — is what supplies the number.
 */

import {
  PUBLISH_RATE_THRESHOLD,
  PUBLISH_RATE_WINDOW_MS,
  publishRateIsUnusual,
  publishRateWindowStart,
} from "./signals";

const NOW = new Date("2026-09-04T12:00:00.000Z");

describe("the publish-rate signal", () => {
  /**
   * **Strictly above.** The threshold is the top of ordinary rather than the
   * bottom of unusual, so a stated ceiling of ten that fired *at* ten would make
   * the number in the copy disagree with the number in the code.
   */
  it("says nothing at the threshold and speaks above it", () => {
    expect(publishRateIsUnusual(PUBLISH_RATE_THRESHOLD)).toBe(false);
    expect(publishRateIsUnusual(PUBLISH_RATE_THRESHOLD + 1)).toBe(true);
  });

  /**
   * **Silent on an ordinary day**, which is the anti-dashboard rule: there are
   * exactly four signals on this surface and none of them is a vanity count. A
   * permanent "the rate is normal" line would be the fifth.
   */
  it("says nothing on a quiet platform", () => {
    expect(publishRateIsUnusual(0)).toBe(false);
    expect(publishRateIsUnusual(1)).toBe(false);
  });

  /** One rolling hour, measured back from the shell's single clock reading. */
  it("measures back one rolling hour from now", () => {
    expect(publishRateWindowStart(NOW).toISOString()).toBe("2026-09-04T11:00:00.000Z");
    expect(PUBLISH_RATE_WINDOW_MS).toBe(3_600_000);
  });

  /**
   * The number itself, pinned. It is C24's answer and moving it is a spec
   * amendment rather than a tuning knob — announcement day tripping the signal is
   * the intended behaviour, not a reason to raise it.
   */
  it("holds the stated rate rather than an inferred one", () => {
    expect(PUBLISH_RATE_THRESHOLD).toBe(10);
  });
});
