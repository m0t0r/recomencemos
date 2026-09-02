/** `/profiles`' copy, and the strings it shares with the Wall. */

import { describeListCopy } from "@/testing/list-copy";
import {
  announcedCount,
  announcedMore,
  LIST_ERROR_EXPLANATION,
  LIST_ERROR_RETRY,
  LIST_ERROR_RETRYING,
  LIST_ERROR_TITLE,
  NOBODY_PUBLISHED_BODY,
  NOBODY_PUBLISHED_TITLE,
  photoAlt,
  TO_BROWSE,
  TO_PUBLISH,
} from "../../_lib/lists/messages";
import {
  BROWSE_LEAD,
  BROWSE_MORE,
  BROWSE_MORE_FAILED,
  BROWSE_MORE_LOADING,
  BROWSE_NARROWED_BODY,
  BROWSE_NARROWED_TITLE,
  BROWSE_TITLE,
} from "./messages";

describeListCopy({
  copy: [
    ["BROWSE_TITLE", BROWSE_TITLE],
    ["BROWSE_LEAD", BROWSE_LEAD],
    ["BROWSE_MORE", BROWSE_MORE],
    ["BROWSE_MORE_LOADING", BROWSE_MORE_LOADING],
    ["BROWSE_MORE_FAILED", BROWSE_MORE_FAILED],
    ["BROWSE_NARROWED_TITLE", BROWSE_NARROWED_TITLE],
    ["BROWSE_NARROWED_BODY", BROWSE_NARROWED_BODY],
    ["TO_BROWSE", TO_BROWSE],
    ["TO_PUBLISH", TO_PUBLISH],
    ["NOBODY_PUBLISHED_TITLE", NOBODY_PUBLISHED_TITLE],
    ["NOBODY_PUBLISHED_BODY", NOBODY_PUBLISHED_BODY],
    ["LIST_ERROR_TITLE", LIST_ERROR_TITLE],
    ["LIST_ERROR_EXPLANATION", LIST_ERROR_EXPLANATION],
    ["LIST_ERROR_RETRY", LIST_ERROR_RETRY],
    ["LIST_ERROR_RETRYING", LIST_ERROR_RETRYING],
    ["announcedCount", announcedCount(12)],
    ["photoAlt", photoAlt("Ana María R.")],
  ],
  labels: [
    ["BROWSE_MORE", BROWSE_MORE],
    ["BROWSE_MORE_LOADING", BROWSE_MORE_LOADING],
    ["TO_BROWSE", TO_BROWSE],
    ["TO_PUBLISH", TO_PUBLISH],
    ["LIST_ERROR_RETRY", LIST_ERROR_RETRY],
    ["LIST_ERROR_RETRYING", LIST_ERROR_RETRYING],
  ],
});

describe("naming the ordering", () => {
  /**
   * The attention spread is stated over the **list**. A card carrying "has
   * received no proposals" would name a person by what has not happened to her,
   * which is the othering the voice guide exists to prevent — so the sentence
   * lives on the page and no card string mentions a proposal at all.
   */
  it("says it about the list, in the list's own lead", () => {
    expect(BROWSE_LEAD).toContain("empezando por quienes");
  });

  it("says nothing about it on a card", () => {
    expect(photoAlt("Ana María R.").toLowerCase()).not.toMatch(/propuesta/);
  });
});

describe("announcing an appended page", () => {
  /**
   * **The number is what arrived, never the running total.** Handing it
   * `rows.length` announced "48 perfiles más" after a second full page, when 24
   * had come — a number a reader would act on and be wrong about. Nothing
   * covered this string, which is how it shipped.
   */
  it("says how many arrived, not how many are now on the page", () => {
    expect(announcedMore(24, 48)).toContain("24 perfiles más");
    expect(announcedMore(24, 48)).not.toContain("48 perfiles más");
  });

  /**
   * A live region announces on a **change** of text, so the delta alone is not
   * enough: two consecutive full pages would both read "24 perfiles más" and the
   * second would reach nobody. The total is what keeps the sentence moving.
   */
  it("changes between two pages of the same size", () => {
    expect(announcedMore(24, 24)).not.toBe(announcedMore(24, 48));
  });

  it("says the total as a total", () => {
    expect(announcedMore(24, 48)).toContain("48 en total");
  });

  it("counts one in the singular", () => {
    expect(announcedMore(1, 25)).toContain("1 perfil más");
    expect(announcedMore(1, 25)).not.toContain("1 perfiles");
  });
});
