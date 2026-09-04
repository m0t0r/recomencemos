/**
 * The Wall's copy against `docs/policy/voice.md`, through the same cases the
 * other public list uses.
 *
 * The Wall carries the cover and the three steps as well as the list, so its
 * strings are the ones where a claim about verification or money would most
 * easily slip in. `describeListCopy` refuses both across everything here.
 */

import { describeListCopy } from "@/testing/list-copy";
import {
  announcedCount,
  LIST_ERROR_EXPLANATION,
  LIST_ERROR_RETRY,
  LIST_ERROR_RETRYING,
  LIST_ERROR_TITLE,
  NOBODY_PUBLISHED_BODY,
  NOBODY_PUBLISHED_TITLE,
  photoAlt,
  TO_BROWSE,
  TO_PUBLISH,
} from "../lists/messages";
import {
  COVER_LEAD,
  COVER_TITLE,
  COVER_TO_PROFILES,
  HOW_HEADING,
  HOW_STEPS,
  publishedRecently,
  RECENT_HEADING,
  VOCABULARY_LABEL,
  WALL_TITLE,
  WALL_TO_BROWSE_HINT,
} from "./messages";

describeListCopy({
  copy: [
    ["COVER_TITLE", COVER_TITLE],
    ["COVER_LEAD", COVER_LEAD],
    ["VOCABULARY_LABEL", VOCABULARY_LABEL],
    ["WALL_TITLE", WALL_TITLE],
    ["RECENT_HEADING", RECENT_HEADING],
    ["WALL_TO_BROWSE_HINT", WALL_TO_BROWSE_HINT],
    ["HOW_HEADING", HOW_HEADING],
    ...HOW_STEPS.flatMap(
      (step, index) =>
        [
          [`HOW_STEPS[${index}].title`, step.title],
          [`HOW_STEPS[${index}].body`, step.body],
        ] as const,
    ),
    ["TO_BROWSE", TO_BROWSE],
    ["TO_PUBLISH", TO_PUBLISH],
    ["COVER_TO_PROFILES", COVER_TO_PROFILES],
    ["NOBODY_PUBLISHED_TITLE", NOBODY_PUBLISHED_TITLE],
    ["NOBODY_PUBLISHED_BODY", NOBODY_PUBLISHED_BODY],
    ["LIST_ERROR_TITLE", LIST_ERROR_TITLE],
    ["LIST_ERROR_EXPLANATION", LIST_ERROR_EXPLANATION],
    ["LIST_ERROR_RETRY", LIST_ERROR_RETRY],
    ["LIST_ERROR_RETRYING", LIST_ERROR_RETRYING],
    ["announcedCount", announcedCount(12)],
    ["publishedRecently", publishedRecently(12)],
    ["photoAlt", photoAlt("Ana María R.")],
  ],
  labels: [
    ["TO_BROWSE", TO_BROWSE],
    ["TO_PUBLISH", TO_PUBLISH],
    ["COVER_TO_PROFILES", COVER_TO_PROFILES],
    ["LIST_ERROR_RETRY", LIST_ERROR_RETRY],
    ["LIST_ERROR_RETRYING", LIST_ERROR_RETRYING],
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

describe("the recent count", () => {
  it("says one person in the singular", () => {
    expect(publishedRecently(1)).toBe("En los últimos siete días publicó 1 persona.");
  });

  it("says the count in the plural", () => {
    expect(publishedRecently(12)).toBe("En los últimos siete días publicaron 12 personas.");
  });
});

describe("the three steps", () => {
  it("are three, in the order they happen", () => {
    expect(HOW_STEPS).toHaveLength(3);
  });

  it("stop where the platform stops", () => {
    // The last step is the Contact Exchange, and the sentence after it says the
    // platform is done — nothing about the work, the payment or a follow-up.
    expect(HOW_STEPS[2]?.body).toMatch(/Hasta ahí llegamos\.$/);
  });
});

describe("the photo alt", () => {
  it("names the person and nothing else", () => {
    expect(photoAlt("Ana María R.")).toBe("Foto de Ana María R.");
  });
});
