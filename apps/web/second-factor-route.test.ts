/**
 * The one string that is spelled in two packages, and the assertion that keeps
 * the two spellings the same.
 *
 * `@repo/domain` throws `SECOND_FACTOR_ROUTE` as a redirect from inside a
 * database hook, at the moment a granted Account's link is spent. `apps/web` has
 * to have a route sitting at exactly that path, and a route is a **directory
 * name** — there is no import between the two and no compiler that can notice
 * they have drifted. What a drift looks like in production is an Admin who
 * follows the link in their own mailbox to a 404, with a live challenge in the
 * browser and nowhere to spend it, and it looks identical to a working deploy
 * from every side except that one.
 *
 * So the check is the filesystem, which is what the framework itself reads.
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { SECOND_FACTOR_ROUTE } from "@repo/domain/auth-handler";

/**
 * Vitest runs each workspace's suite from that workspace's own directory, and
 * `import.meta.url` is not a `file:` URL under happy-dom — so this is the one
 * anchor available. The assertion below that `app/layout.tsx` is here is what
 * keeps a wrong anchor from reading as a passing test.
 */
const app = (group: string, route: string) => resolve(process.cwd(), `app/${group}${route}`);

describe("the route a spent Admin link lands on", () => {
  // Every assertion below is an `existsSync` over a path built from the working
  // directory, and a wrong directory would make all of them pass by answering
  // `false` to questions nobody asked. This is what says the anchor is real.
  it("is looked for in this app's own tree", () => {
    expect(existsSync(resolve(process.cwd(), "app/layout.tsx"))).toBe(true);
  });

  it("has a page at the path @repo/domain redirects to", () => {
    expect(existsSync(`${app("(token)", SECOND_FACTOR_ROUTE)}/page.tsx`)).toBe(true);
  });

  /**
   * **It names no admin surface, and that is the property rather than the
   * path.** The redirect is received by whatever consumed the link — a corporate
   * link scanner, a WhatsApp preview, Outlook Safe Links — so `/admin` in a
   * `Location` would make a granted address distinguishable in a gateway's logs.
   * Asserted as a substring rather than against the literal `/continue`, because
   * what may not change is the disclosure, not the word.
   */
  it("says nothing about the surface behind it", () => {
    expect(SECOND_FACTOR_ROUTE.toLowerCase()).not.toContain("admin");
  });

  /**
   * The group is `(token)` and not `(admin)`, and that is load-bearing rather
   * than filing: `(admin)/layout.tsx` renders `AdminHeader`, which asks "am I
   * signed in, as whom, how do I leave" — three questions with no true answer on
   * a page where no session exists yet — and links a wordmark to the queue,
   * which would tell whoever holds a stolen link that a queue is there.
   */
  it("is outside the group that renders the signed-in chrome", () => {
    expect(existsSync(`${app("(admin)", SECOND_FACTOR_ROUTE)}/page.tsx`)).toBe(false);
  });
});
