/**
 * The **list-specific** half of the voice suite the two public lists share.
 *
 * `/` and `/profiles` are two surfaces with two `_lib`s and the prior art is one
 * copy suite per surface — `publish-copy`, `my-profile-copy`, `sign-in-copy`.
 * What they do not have is a third module of shared strings between them, which
 * these two do, so the rules run from here and each surface names what it
 * renders. A string that reaches a screen and appears in neither list is the
 * failure this shape is guarding against.
 *
 * **The countable rules moved to `testing/surface-copy.ts`** when a fourth suite
 * copied them verbatim; this delegates and adds the three cases that are true of
 * a *list* and of nothing else. Callers are unchanged.
 *
 * What is **not** here is the half no test reaches: whether the care is aimed at
 * the process rather than at the person, which is a reading a person does.
 */

import { describeSurfaceCopy, type SurfaceCopy } from "./surface-copy";

export type ListCopy = SurfaceCopy;

export function describeListCopy({ copy, labels }: ListCopy): void {
  describeSurfaceCopy({ copy, labels });

  /**
   * **Neither list claims anything about verification or money.** Those are
   * story 11's two standing notices, and a half-version on a list would give
   * them a second source — which is the one thing worse than an absent notice.
   */
  describe("what this list does not say", () => {
    const everything = copy
      .map(([, value]) => value)
      .join(" ")
      .toLowerCase();

    it("makes no claim about verification", () => {
      expect(everything).not.toMatch(/verifica/);
    });

    it("makes no claim about money", () => {
      expect(everything).not.toMatch(/\b(dinero|pagos|plata|comisión)\b/);
    });

    /**
     * The ordering is a property of the list, and a card carrying "has received
     * no proposals" would label a person by what has not happened to her. No
     * string a *card* renders mentions a proposal at all.
     */
    it("never says on a card what the list says about itself", () => {
      const cardStrings = copy.filter(([name]) => name.startsWith("photoAlt"));

      for (const [, value] of cardStrings) {
        expect(value.toLowerCase()).not.toMatch(/propuesta/);
      }
    });
  });
}
