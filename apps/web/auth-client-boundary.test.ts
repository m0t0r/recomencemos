// @vitest-environment node

/**
 * **No module under `app/` imports an auth client**, which is the first half of
 * [ADR-0015](../../docs/adr/0015-both-doors-are-server-actions-and-the-browser-holds-no-auth-client.md):
 * both doors are Server Actions calling `@repo/domain/auth-handler`, and nothing
 * in a browser holds a client of its own.
 *
 * **It lives here, beside the other two boundary suites, because the last two
 * copies of it lived inside the surfaces they swept and one of them died with
 * its surface.** There were two: one rooted at `app/(site)/(auth)/sign-in/`
 * inside that door's component test, and one rooted at `app/(admin)/` inside the
 * password door's. Deleting the password door deleted the second, and with it
 * the only sweep that reached `(admin)`, `(token)` and `app/_components` — a
 * guard removed by a change that had nothing to say about it, which is the
 * failure mode a file's location can prevent and a reviewer cannot. `/code-review`
 * caught it; this is the shape that stops it recurring.
 *
 * So the root is `app/` and there is one copy. A route deleted from under it
 * narrows what this walks and cannot narrow what it asserts.
 *
 * **Asserting it by rendering is not possible** — a browser bundle is a build
 * artefact and this suite is not a build. So it is asserted over the *source* of
 * every module under `app/`, which is the thing a person would actually change by
 * accident: reaching for `createAuthClient` because it is the shape every Better
 * Auth tutorial shows.
 *
 * The failure it prevents is not subtle in production and is invisible in review:
 * one `better-auth/react` import puts the auth client, `@better-fetch`,
 * `nanostores` and `defu` back into the bundle a Worker downloads on a metered
 * connection, and NFR3's budget is measured on `/` and `/publish` rather than on
 * whichever surface acquired the import — so nothing else would report it.
 *
 * `domain-boundary.test.ts` and `notifications-boundary.test.ts` are the
 * neighbours and the precedent: a claim a package or an app makes that it cannot
 * check from inside itself, asserted where the consumer sits.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Every source file under `app/`, tests excluded. */
function sourcesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourcesUnder(path);
    return /\.tsx?$/.test(entry.name) && !entry.name.includes(".test.") ? [path] : [];
  });
}

/**
 * **Comments are stripped before matching, and that is not a convenience.** The
 * first version of this guard failed on `sign-in/actions.ts`, whose doc comment
 * explains that the door "was `createAuthClient().signIn.social(...)` from a
 * Client Component" — prose about the thing being banned, read as the thing
 * itself. It is the same false-positive class `gate-lib.sh` strips heredocs for:
 * a rule that refuses the sentence documenting it teaches everyone to stop
 * writing the sentence.
 */
function code(source: string): string {
  return source.replaceAll(/\/\*[\s\S]*?\*\//g, "").replaceAll(/\/\/[^\n]*/g, "");
}

const APP = join(import.meta.dirname, "app");

describe("no auth client reaches the browser", () => {
  /**
   * **The list is asserted before it is walked**, because `it.each` over an empty
   * array is a green run that checked nothing — and a wrong root spells itself
   * exactly that way. This is the assertion that would have made the deleted
   * sweep's absence visible, had the sweep been here to lose its root.
   */
  it("has files to sweep", () => {
    expect(sourcesUnder(APP).length).toBeGreaterThan(20);
  });

  it.each(sourcesUnder(APP).map((path) => [path.slice(APP.length + 1), path]))(
    "%s imports no auth client",
    (_name, path) => {
      const source = code(readFileSync(path, "utf8"));

      // A server module reaching `lib/auth` is fine and expected — that is the
      // handler. What must never appear anywhere under `app/` is the *browser*
      // client, in any of the three spellings a tutorial offers.
      expect(source).not.toMatch(/from\s+["']better-auth\/react["']/);
      expect(source).not.toMatch(/from\s+["']better-auth\/client["']/);
      expect(source).not.toMatch(/createAuthClient/);
    },
  );
});
