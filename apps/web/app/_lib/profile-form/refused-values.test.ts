/**
 * The half of "nothing you typed was lost" that the unhydrated path depends
 * on: a refusal carries her values back, and the form seeds itself from them.
 *
 * Pure, so it is pinned here. The running half is verified at seam 3 for the
 * **edit** form — a native POST carrying `Origin`, no JavaScript in the picture
 * — because that action binds nothing and re-renders normally. `/publish`'s
 * still cannot: its unhydrated refusal meets the framework fault recorded on
 * the ticket.
 */

import { publishProfileFields } from "./schema";
import { treeFromIssues } from "./summary";
import { refusedValuesOf } from "./use-profile-form";

const VALUES = {
  fullName: "Luisa Fernanda Ortiz",
  firstName: "Luisa",
  lastInitial: "o",
  city: "santa_rosa_de_cabal",
  headline: "Cuido niños, llámame al 300 555 0000",
  about: "",
  phone: "301 222 3333",
  skillSlugs: ["child-care"],
  workHistory: ["Jardín infantil Los Pinos"],
  consent: true,
};

describe("refusedValuesOf", () => {
  it("reads her values off a returned refusal", () => {
    expect(
      refusedValuesOf({
        serverError: { code: "publish_refused", message: "x", requestId: "r", input: VALUES },
      }),
    ).toEqual(VALUES);
  });

  it("reads them off a ceiling refusal too, which echoes the parsed input", () => {
    expect(
      refusedValuesOf({
        serverError: {
          code: "rate_limited",
          message: "x",
          requestId: "r",
          retryAfter: 60,
          input: VALUES,
        },
      }),
    ).toEqual(VALUES);
  });

  /**
   * The edit form has no consent field, so an edit's refusal echoes nine
   * fields and never a tenth. A reader that insisted on the tenth returned
   * nothing for every refused edit — and nothing is what the unhydrated page
   * then re-rendered her fields from, under a sentence promising that what she
   * typed had survived. Found at seam 3, against a running server.
   */
  it("reads them off an edit's refusal, which carries no consent at all", () => {
    const { consent: _consent, ...edited } = VALUES;

    expect(
      refusedValuesOf({
        serverError: {
          code: "profile_update_refused",
          message: "x",
          requestId: "r",
          input: edited,
        },
      }),
    ).toEqual(edited);
  });

  it("is nothing when the input is absent or not the form's shape", () => {
    expect(refusedValuesOf({})).toBeUndefined();
    expect(
      refusedValuesOf({
        serverError: { code: "x", message: "x", requestId: "r", input: { nope: 1 } },
      }),
    ).toBeUndefined();
  });
});

describe("treeFromIssues", () => {
  it("nests a work-history line under its index and everything else under its field", () => {
    const result = publishProfileFields.safeParse({
      ...VALUES,
      firstName: "",
      workHistory: ["a".repeat(121)],
    });
    if (result.success) throw new Error("expected a refusal");

    const tree = treeFromIssues(result.error.issues);

    // `_errors` is next-safe-action's own key for a node's messages.
    // oxlint-disable-next-line no-underscore-dangle
    expect(tree.firstName?._errors).toHaveLength(1);
    // oxlint-disable-next-line no-underscore-dangle
    expect(tree.workHistory?.[0]?._errors).toHaveLength(1);
    expect(tree.headline).toBeUndefined();
  });
});
