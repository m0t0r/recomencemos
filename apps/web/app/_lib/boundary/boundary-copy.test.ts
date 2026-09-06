/**
 * The countable half of the voice guide over the three app-wide boundaries,
 * plus the two rules that are this surface's alone.
 *
 * The shared cases come from `@/testing/surface-copy`, which is where they live
 * for every suite — this file is the fourth caller and the reason that function
 * was extracted. What is added below is what only this surface can be asked:
 * whether its refusal is an oracle, and whether the root boundary's own document
 * title survived the translation.
 */

import { describeSurfaceCopy } from "@/testing/surface-copy";
import {
  BOUNDARY_COPY,
  BOUNDARY_LABELS,
  NOT_FOUND_EXPLANATION,
  NOT_FOUND_LINK,
  NOT_FOUND_ONWARD,
  NOT_FOUND_PAGE_TITLE,
  NOT_FOUND_TITLE,
  ROOT_ERROR_PAGE_TITLE,
} from "./messages";

describeSurfaceCopy({
  copy: Object.entries(BOUNDARY_COPY),
  labels: Object.entries(BOUNDARY_LABELS),
});

/**
 * The rule that is this surface's own, and the reason it is a test rather than a
 * comment.
 *
 * Three of the four ways a person reaches the not-found page are the spec's
 * `permission denied` cell answered as a 404 deliberately — not the owner at
 * `/my-profile`, and a spent, expired or unknown token at either token route,
 * where the spec's words are that a legible refusal is an oracle for which
 * tokens existed. The fourth is a mistyped URL.
 *
 * So the page must read identically to all four. Each case below is one way a
 * later edit would quietly pick one of them out — an invitation to sign in, a
 * word about permission, a confident claim that nothing is there, or the name of
 * a route only one population was reaching for.
 */
describe("the not-found copy is not an oracle", () => {
  /**
   * Every string the surface puts on screen, and two that are easy to leave out.
   *
   * The **document title** is read before the page paints and survives into a
   * browser's history, so it leaks exactly as loudly as the heading. The **link
   * text** is the one string here that could name a destination only one of the
   * four populations was reaching for — *Ir a tu perfil* would be an oracle in a
   * single phrase.
   */
  const notFound = [
    NOT_FOUND_TITLE,
    NOT_FOUND_PAGE_TITLE,
    NOT_FOUND_EXPLANATION,
    NOT_FOUND_ONWARD,
    NOT_FOUND_LINK,
  ];

  const authorization = [
    "sesión",
    "entra",
    "entrar",
    "permiso",
    "autorizad",
    "acceso",
    "cuenta",
    "dueñ",
    "tuya",
    "tuyo",
  ];

  it.each(authorization)("says nothing about %o", (word) => {
    for (const value of notFound) {
      expect(value.toLowerCase()).not.toContain(word);
    }
  });

  /**
   * A route named here is a route the reader was not necessarily asking for.
   * `/admin` in particular: the token surfaces refuse without ever naming it,
   * and this page answers for them.
   */
  it.each(["/admin", "/my-profile", "/publish", "admin", "token"])(
    "names no route or credential (%o)",
    (fragment) => {
      for (const value of notFound) {
        expect(value.toLowerCase()).not.toContain(fragment);
      }
    },
  );

  /**
   * The hedge is load-bearing. A flat assertion that the page does not exist is
   * false for three of the four populations, and false in the direction that
   * tells a prober the resource is absent when it is present.
   */
  it("does not claim the page never existed", () => {
    expect(NOT_FOUND_EXPLANATION.toLowerCase()).not.toMatch(/\bno existe\b/);
    expect(NOT_FOUND_TITLE.toLowerCase()).not.toMatch(/\bno existe\b/);
  });

  it("offers somewhere to go instead", () => {
    expect(NOT_FOUND_ONWARD.toLowerCase()).toContain("muro");
  });
});

/**
 * The root boundary supplies its own `<title>`, because it replaces the root
 * layout and `metadata` is not in play. A document with no title fails WCAG
 * 2.4.2; one titled in the wrong language is announced with the wrong phonemes,
 * which is the same mistake `lang` makes and is why both moved together.
 */
describe("the root boundary's document title", () => {
  it("names the product", () => {
    expect(ROOT_ERROR_PAGE_TITLE).toContain("Recomencemos");
  });

  it("is Spanish, not the English it replaced", () => {
    expect(ROOT_ERROR_PAGE_TITLE.toLowerCase()).not.toContain("something went wrong");
  });
});
