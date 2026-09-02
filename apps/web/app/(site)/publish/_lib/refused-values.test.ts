/**
 * The half of "nothing you typed was lost" that the unhydrated path depends
 * on: a refusal carries her values back, and the form seeds itself from them.
 * Pure, so it is pinned here; the running check is blocked by a framework
 * fault recorded on the ticket.
 */

import { publishProfileFields } from "./schema";
import { treeFromIssues } from "./summary";
import { refusedValuesOf } from "./use-publish";

// The hook module imports the Server Action, whose module carries
// `server-only`; the function under test needs neither. The factory closes
// over nothing, so it needs no `vi.hoisted`.
vi.mock("../actions", () => ({ publishProfile: vi.fn() }));

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
