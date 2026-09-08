/**
 * The standing notices as a table over the route list — story 11's first
 * acceptance criterion, which asks that surfaces built afterwards carry the
 * notices "by construction" rather than by somebody remembering.
 *
 * **This is the construction.** It walks every `page.tsx` under `app/`, derives
 * the route each one serves, and asserts two things that between them leave no
 * third state:
 *
 * 1. every page under a prefix in `NOTICE_ROUTE_PREFIXES` renders the component;
 * 2. every page is **classified** — required or exempt, never neither.
 *
 * The second is the one with teeth. A new surface that nobody thought about
 * matches no prefix and appears on no exemption list, so it fails here on the
 * commit that adds it, and the failure names the route and says what to do. The
 * first alone would be satisfied by an empty list.
 *
 * **It reads source rather than rendering**, which is deliberate and is what
 * `CLAUDE.md` names `web:test` for — "table-driven assertions over a route list".
 * Rendering would answer the question only for routes that exist and only for
 * pages Vitest can reach, and `async` Server Components are exactly the pages it
 * cannot. What the notices *look* like is a seam-3 question and is verified
 * running; whether every surface has them is a question about the tree, and the
 * tree is what this reads.
 *
 * **It runs in Node**, because it touches the filesystem and has nothing to say
 * to a DOM.
 */

// @vitest-environment node

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  NOTICE_EXEMPT_ROUTES,
  noticeCarveOuts,
  NOTICE_ROUTE_PREFIXES,
  noticesExemptOn,
  noticesRequiredOn,
} from "./lib/notice-surfaces";

const APP_DIR = join(import.meta.dirname, "app");

/** The component a page has to render, matched as it is written in a call. */
const RENDERS_NOTICES = /<StandingNotices[\s/>]/;

interface Surface {
  /** The URL path the page serves, with dynamic segments left as written. */
  readonly route: string;
  readonly file: string;
}

/**
 * Every `page.tsx` under `app/`, as the route it serves.
 *
 * Two of Next's conventions do the work here and both drop out of the path:
 * a **route group** (`(site)`, `(admin)`, `(token)`) adds no URL segment, and a
 * **private folder** (`_components`, `_lib`) is excluded from routing entirely —
 * so a `page.tsx` cannot live under one, and skipping them keeps the walk from
 * wandering into component directories.
 */
function surfaces(directory: string, segments: readonly string[] = []): Surface[] {
  const found: Surface[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name.startsWith("_") || entry.name.startsWith(".")) continue;

      const isRouteGroup = entry.name.startsWith("(") && entry.name.endsWith(")");
      found.push(
        ...surfaces(
          join(directory, entry.name),
          isRouteGroup ? segments : [...segments, entry.name],
        ),
      );
      continue;
    }

    if (entry.name === "page.tsx") {
      found.push({
        route: segments.length === 0 ? "/" : `/${segments.join("/")}`,
        file: join(directory, entry.name),
      });
    }
  }

  return found;
}

const ALL_SURFACES = surfaces(APP_DIR);

describe("the standing notices reach every surface that owes them", () => {
  /**
   * A guard on the walk itself. If the traversal broke — a renamed `app/`, a
   * convention change, a thrown `readdirSync` swallowed somewhere — every
   * assertion below would pass over an empty list and report a clean tree, which
   * is the failure mode `scripts/migration-integrity.mjs` exits `2` to avoid.
   */
  it("finds the surfaces at all", () => {
    expect(ALL_SURFACES.length).toBeGreaterThan(10);
    expect(ALL_SURFACES.map((surface) => surface.route)).toContain("/");
  });

  const required = ALL_SURFACES.filter((surface) => noticesRequiredOn(surface.route));

  it("finds at least the three surfaces that carry them today", () => {
    expect(required.map((surface) => surface.route).toSorted()).toEqual([
      "/",
      "/my-profile",
      "/profiles",
    ]);
  });

  it.each(required)("$route renders them", ({ file }) => {
    expect(readFileSync(file, "utf8")).toMatch(RENDERS_NOTICES);
  });

  /**
   * **The teeth.** A page that is neither required nor excused is a surface
   * somebody added without taking the decision, and this is where that is
   * caught — on the commit that adds it, rather than on the read where a person
   * needed the notices and they were not there.
   */
  it.each(ALL_SURFACES)("$route is classified", ({ route }) => {
    const classified = noticesRequiredOn(route) || noticesExemptOn(route);

    expect(
      classified,
      `${route} is on neither list. Add its prefix to NOTICE_ROUTE_PREFIXES if a person meets another person there, or to NOTICE_EXEMPT_ROUTES with the reason.`,
    ).toBe(true);
  });

  /**
   * An exemption for a route that no longer exists is a line nobody will delete
   * and the next reader will trust. It is the same argument `CLAUDE.md` makes
   * about pruning `minimumReleaseAgeExclude`.
   */
  it.each(NOTICE_EXEMPT_ROUTES)("the exemption for $route still names a real page", ({ route }) => {
    expect(ALL_SURFACES.map((surface) => surface.route)).toContain(route);
  });

  it.each(NOTICE_EXEMPT_ROUTES)("the exemption for $route says why", ({ reason }) => {
    expect(reason.trim().length).toBeGreaterThan(10);
  });
});

describe("the route list itself", () => {
  /**
   * Retyped rather than derived, so a change to the source list fails here
   * instead of silently agreeing with itself — the shape `gated-routes.test.ts`
   * already uses for NFR8's six prefixes, and for the same reason.
   */
  it("names the six prefixes the notices bind", () => {
    expect(NOTICE_ROUTE_PREFIXES.toSorted()).toEqual([
      "/",
      "/my-profile",
      "/offers",
      "/profile",
      "/profiles",
      "/sent-offers",
    ]);
  });

  /**
   * `/profile` and `/profiles` differ by one character and are different lists,
   * which is the trap `gated-routes.test.ts` guards from the other direction. A
   * prefix match written as a bare `startsWith` would make `/profile` swallow
   * `/profiles`; here they are both required, so the bug would be invisible —
   * until somebody exempts one of them.
   */
  it("treats /profile and /profiles as separate prefixes", () => {
    expect(noticesRequiredOn("/profile/alguien")).toBe(true);
    expect(noticesRequiredOn("/profiles")).toBe(true);
    expect(NOTICE_ROUTE_PREFIXES).toContain("/profile");
    expect(NOTICE_ROUTE_PREFIXES).toContain("/profiles");
  });

  /**
   * `/` is the one prefix that must not behave like a prefix. Every route starts
   * with it, so a naive `startsWith("/")` would mark the whole application
   * required and make the exemption list unreachable — the gate would pass by
   * demanding the impossible everywhere, which reads exactly like it working.
   */
  it("does not let / swallow every route", () => {
    expect(noticesRequiredOn("/")).toBe(true);
    expect(noticesRequiredOn("/sign-in")).toBe(false);
    expect(noticesRequiredOn("/admin")).toBe(false);
  });

  /**
   * **The carve-outs, pinned.** An exemption that sits outside every prefix takes
   * nothing away; one that sits *inside* a prefix overrides a default that exists
   * to catch the surfaces nobody thought about. There is exactly one, it is a
   * form, and this is retyped so that a second cannot arrive without somebody
   * changing this line and saying why in the pull request.
   */
  it("carves exactly one route out of a required prefix", () => {
    expect(noticeCarveOuts()).toEqual(["/my-profile/edit"]);
  });

  it("lets an exemption win over the prefix it sits under", () => {
    expect(noticesExemptOn("/my-profile/edit")).toBe(true);
    expect(noticesRequiredOn("/my-profile/edit")).toBe(false);
    expect(noticesRequiredOn("/my-profile")).toBe(true);
  });
});
