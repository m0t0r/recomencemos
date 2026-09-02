/**
 * The Wall's copy, and the strings it shares with `/profiles`.
 *
 * The shared strings are named here **and** in `browse-copy.test.ts`: they are
 * rendered on both surfaces, and a rule that ran over them once would leave the
 * other surface's suite silently incomplete.
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
} from "../lists/messages";
import { WALL_LEAD, WALL_TITLE, WALL_TO_BROWSE_HINT } from "./messages";

describeListCopy({
  copy: [
    ["WALL_TITLE", WALL_TITLE],
    ["WALL_LEAD", WALL_LEAD],
    ["WALL_TO_BROWSE_HINT", WALL_TO_BROWSE_HINT],
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
    ["TO_BROWSE", TO_BROWSE],
    ["TO_PUBLISH", TO_PUBLISH],
    ["GRID_ERROR_RETRY", GRID_ERROR_RETRY],
    ["GRID_ERROR_RETRYING", GRID_ERROR_RETRYING],
  ],
});

describe("the announced count", () => {
  it("says one profile in the singular", () => {
    expect(announcedCount(1)).toBe("1 perfil");
  });

  it("says the count and the plural noun, and nothing else", () => {
    expect(announcedCount(24)).toBe("24 perfiles");
  });
});

describe("the photo alt", () => {
  /**
   * It says what the image shows and nothing about her circumstances — the voice
   * guide bans the earthquake as a property of a person in an `alt` attribute by
   * name, and this is the attribute it names.
   */
  it("names the person and nothing else", () => {
    expect(photoAlt("Ana María R.")).toBe("Foto de Ana María R.");
  });
});
