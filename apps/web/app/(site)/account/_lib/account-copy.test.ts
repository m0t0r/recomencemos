/**
 * The countable half of `docs/policy/voice.md` over every string `/account`
 * renders, plus the rules that are this surface's alone.
 *
 * The shared cases come from `@/testing/surface-copy`, which is where they live
 * for every suite. What is added below is what only this surface can be asked:
 * that the marker names no hardware, that the confirmation says this session
 * survives, and that an unreadable `User-Agent` degrades to an honest absence.
 *
 * **It reads the module rather than an object inside it**, which is the one way
 * this file differs from its siblings. They each group their strings into a
 * `*_COPY` object and pass that; this module was written as named exports before
 * the convention settled, and reflecting over the namespace covers a string
 * added tomorrow without anyone remembering to add it to a list. What it costs
 * is that a string's role — body or label — cannot be read off the shape, so the
 * label set is named below and asserted to be complete.
 *
 * Every string here is rendered by something. `FEEDBACK_REGION_LABEL` was the
 * exception until it was wired to the live region it was written for, and a
 * string put under the voice rules while nobody reads it is copy nobody could
 * correct by looking at the product.
 */

import { describeSurfaceCopy } from "@/testing/surface-copy";
import * as messages from "./messages";

/**
 * The strings a person reads that are built rather than declared. Both take a
 * count, and the count is the whole reason they are functions, so each is
 * exercised in both of its forms.
 */
const BUILT_LABELS: readonly (readonly [string, string])[] = [
  ["closeOthersButton(1)", messages.closeOthersButton(1)],
  ["closeOthersButton(2)", messages.closeOthersButton(2)],
];

const BUILT_COPY: readonly (readonly [string, string])[] = [
  ["closedOthers(1)", messages.closedOthers(1)],
  ["closedOthers(2)", messages.closedOthers(2)],
];

/**
 * Labels, buttons and headings: five words or fewer. `ACCOUNT_PAGE_TITLE` is
 * read in a browser tab rather than on the page, which is the same budget.
 */
const LABEL_NAMES = new Set([
  "ACCOUNT_TITLE",
  "ACCOUNT_PAGE_TITLE",
  "SESSIONS_HEADING",
  "CURRENT_SESSION_MARKER",
  "FEEDBACK_REGION_LABEL",
]);

/**
 * Every string the module declares. `flatMap` rather than `filter` with a type
 * predicate: the predicate would have to narrow a tuple's second element, which
 * it cannot do, and building the pair is both shorter and honest about it.
 */
const declared: readonly [string, string][] = Object.entries(messages).flatMap(([name, value]) =>
  typeof value === "string" ? [[name, value] as [string, string]] : [],
);

const labels = [...declared.filter(([name]) => LABEL_NAMES.has(name)), ...BUILT_LABELS];

describeSurfaceCopy({ copy: [...declared, ...BUILT_COPY, ...BUILT_LABELS], labels });

describe("the label set", () => {
  /**
   * The one thing namespace reflection cannot do for itself: a label renamed in
   * `messages.ts` would silently drop out of the five-word ceiling and stay in
   * the body cases, where twenty words are allowed.
   */
  it("names every label the module declares", () => {
    expect(labels.map(([name]) => name)).toHaveLength(LABEL_NAMES.size + BUILT_LABELS.length);
  });
});

/**
 * The rules this surface has of its own, each one a decision recorded in
 * `messages.ts` that a later edit could undo without noticing.
 */
describe("the surface's own rules", () => {
  // A session is a browser, not a machine: two browsers on one laptop are two
  // rows, and any device noun would tell her the other one is somewhere else.
  it.each(["aparato", "dispositivo", "teléfono", "computador"])(
    "the current-session marker does not say %o",
    (noun) => {
      expect(messages.CURRENT_SESSION_MARKER.toLowerCase()).not.toContain(noun);
    },
  );

  it("says nothing is wrong when this is the only session", () => {
    expect(messages.ONLY_THIS_SESSION).toBe(
      "Esta es tu única sesión abierta. No hay nada más que cerrar.",
    );
  });

  // The second half is the load-bearing one: without it a person who has just
  // closed sessions cannot tell whether she is about to be signed out too.
  it.each([1, 2])("tells her this session survives, having closed %i", (count) => {
    expect(messages.closedOthers(count)).toContain("Esta sigue abierta.");
  });

  it("quotes the count back at her rather than saying todas", () => {
    expect(messages.closedOthers(2)).toContain("2");
    expect(messages.closeOthersButton(2)).toContain("2");
  });

  // An unreadable `User-Agent` degrades to an honest absence rather than to a
  // placeholder that reads like a device name.
  it("says it does not know, where it does not know", () => {
    expect(messages.deviceLabel(null, null)).toBe(messages.UNKNOWN_DEVICE);
    expect(messages.deviceLabel("Chrome", null)).toBe("Chrome");
    expect(messages.deviceLabel(null, "Android")).toBe("Android");
    expect(messages.deviceLabel("Chrome", "Android")).toBe("Chrome en Android");
  });
});
