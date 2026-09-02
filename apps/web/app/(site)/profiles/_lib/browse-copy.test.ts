/**
 * `/profiles`' copy, and the strings it shares with the Wall.
 *
 * `BROWSE_LEAD_QUIET` is prototype copy — variant C's framing — and is listed
 * anyway: it renders on a real route against real data, and a rendered string
 * outside the suite is a rendered string nothing checks.
 */

import { describeListCopy } from "@/testing/list-copy";
import {
  announcedCount,
  GRID_ERROR_EXPLANATION,
  GRID_ERROR_RETRY,
  GRID_ERROR_RETRYING,
  GRID_ERROR_TITLE,
  NOBODY_PUBLISHED_BODY,
  NOBODY_PUBLISHED_TITLE,
  photoAlt,
  TO_BROWSE,
  TO_PUBLISH,
} from "../../_lib/lists/messages";
import {
  BROWSE_LEAD,
  BROWSE_LEAD_QUIET,
  BROWSE_MORE,
  BROWSE_NARROWED_BODY,
  BROWSE_NARROWED_TITLE,
  BROWSE_TITLE,
} from "./messages";

describeListCopy({
  copy: [
    ["BROWSE_TITLE", BROWSE_TITLE],
    ["BROWSE_LEAD", BROWSE_LEAD],
    ["BROWSE_LEAD_QUIET", BROWSE_LEAD_QUIET],
    ["BROWSE_MORE", BROWSE_MORE],
    ["BROWSE_NARROWED_TITLE", BROWSE_NARROWED_TITLE],
    ["BROWSE_NARROWED_BODY", BROWSE_NARROWED_BODY],
    ["TO_BROWSE", TO_BROWSE],
    ["TO_PUBLISH", TO_PUBLISH],
    ["NOBODY_PUBLISHED_TITLE", NOBODY_PUBLISHED_TITLE],
    ["NOBODY_PUBLISHED_BODY", NOBODY_PUBLISHED_BODY],
    ["GRID_ERROR_TITLE", GRID_ERROR_TITLE],
    ["GRID_ERROR_EXPLANATION", GRID_ERROR_EXPLANATION],
    ["GRID_ERROR_RETRY", GRID_ERROR_RETRY],
    ["GRID_ERROR_RETRYING", GRID_ERROR_RETRYING],
    ["announcedCount", announcedCount(12)],
    ["photoAlt", photoAlt("Ana María R.")],
  ],
  labels: [
    ["BROWSE_MORE", BROWSE_MORE],
    ["TO_BROWSE", TO_BROWSE],
    ["TO_PUBLISH", TO_PUBLISH],
    ["GRID_ERROR_RETRY", GRID_ERROR_RETRY],
    ["GRID_ERROR_RETRYING", GRID_ERROR_RETRYING],
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
