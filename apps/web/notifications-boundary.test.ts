// @vitest-environment node

/**
 * The two claims `@repo/notifications` makes that it cannot check from inside
 * itself.
 *
 * **Node, not happy-dom, and the override is itself a demonstration.** This
 * app's suite runs in a DOM environment, so `globalThis.window` is defined —
 * and importing `@repo/observability/logger` under it throws, because
 * `assertServerOnly()` is doing exactly what it exists to do. A test that needs
 * the real logger therefore has to say it is not a browser. Neither half below
 * touches the DOM: one asks Node's resolver a question, the other assigns a
 * server module to a port.
 *
 * `domain-boundary.test.ts` is the shape and the reasoning: Node's own resolver,
 * both directions, asserted where the consumer sits rather than where the
 * manifest is written.
 *
 * **The third block is a manifest-shape assertion rather than a resolution one,
 * and that is a limit worth stating.** `createRequire().resolve` answers under
 * the conditions *this* process runs with, and there is no way to ask it for
 * `browser` — so the `browser` condition cannot be proved the way the other two
 * halves are. What it can be is read off the map that Node consults, which is
 * what that block does. The proof that the condition *works* is the build error
 * quoted in `packages/notifications/src/browser-refusal.ts`, produced by hand
 * against a real `"use client"` import; `@repo/observability` records its own
 * the same way, and has no automated test for its condition at all.
 *
 * The second claim is the one this file exists for. The notification seam emits
 * its `notification.sent` line through a **port it declares** —
 * `NotificationLogger` — rather than by importing `@repo/observability`, because
 * the spec's dependency graph gives that package one workspace dependency and it
 * is `@repo/errors`. That design is only sound if the logger this repo actually
 * has satisfies the port. `@repo/notifications` cannot prove that: proving it
 * means importing the thing it is forbidden to depend on. `apps/web` depends on
 * both, so it is where the two halves meet.
 */

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { logger } from "@repo/observability/logger";
import type { NotificationLogger } from "@repo/notifications/send";

const require = createRequire(import.meta.url);

/**
 * The internals. Each is reachable inside the package through its `#` specifier
 * and from nowhere else — which is what stops a call site building a `Resend`
 * client of its own and routing around the kill switch.
 */
const WITHHELD = [
  // No `"."` entry, so importing the package bare is not a shortcut either.
  "@repo/notifications",
  "@repo/notifications/config",
  "@repo/notifications/palette",
  "@repo/notifications/transport/resend",
  // The development inbox is internal for a second reason on top of the usual
  // one: it is the only module here that can cause silence rather than an
  // error, and `NOTIFICATIONS_TRANSPORT` plus its own NODE_ENV guard are the
  // two things standing between it and a deploy. A reachable subpath would be a
  // third way in that neither of them covers.
  "@repo/notifications/transport/terminal",
];

/** The spec's two public subpaths, and therefore what must actually resolve. */
const PUBLISHED = [
  "@repo/notifications/send",
  "@repo/notifications/templates/base",
  "@repo/notifications/templates/magic-link",
];

describe("the notifications package's export map", () => {
  it.each(WITHHELD)("refuses %s to apps/web", (specifier) => {
    expect(() => require.resolve(specifier)).toThrow(
      expect.objectContaining({ code: "ERR_PACKAGE_PATH_NOT_EXPORTED" }),
    );
  });

  it.each(PUBLISHED)("resolves %s, so the refusals above mean something", (specifier) => {
    expect(require.resolve(specifier)).toContain("packages/notifications");
  });
});

/**
 * The refusal module every published subpath resolves to for a browser, read
 * off the manifest Node itself consults rather than off a path this file
 * spells. Resolving `./send` gives the package root without a second constant
 * to keep in step with the first.
 */
const BROWSER_REFUSAL = "./src/browser-refusal.ts";

interface Manifest {
  readonly exports: Record<string, string | Record<string, string>>;
}

function notificationsManifest(): Manifest {
  const sendPath = require.resolve("@repo/notifications/send");
  const packageRoot = sendPath.slice(0, sendPath.indexOf("/src/"));

  return JSON.parse(readFileSync(`${packageRoot}/package.json`, "utf8")) as Manifest;
}

describe("the browser condition on that map", () => {
  /**
   * The half `require.resolve` cannot be asked about. Without it a
   * `"use client"` module importing the send seam resolves cleanly, and the
   * only thing between it and `resend` plus the code path that reads
   * `RESEND_API_KEY` is a runtime throw that fires *after* the module is in the
   * bundle — which is the inversion ADR-0013 made visible and #64 closed.
   */
  it.each(PUBLISHED)("points %s at the package's own refusal module", (specifier) => {
    const subpath = `.${specifier.slice("@repo/notifications".length)}`;
    const pattern = subpath.replace(/\/(base|magic-link)$/, "/*");
    const entry = notificationsManifest().exports[pattern];

    expect(entry).toMatchObject({ browser: BROWSER_REFUSAL });
  });

  it("leaves every published subpath resolving to its real module otherwise", () => {
    for (const entry of Object.values(notificationsManifest().exports)) {
      expect(entry).toMatchObject({ default: expect.not.stringContaining("browser-refusal") });
    }
  });
});

describe("the logging port", () => {
  /**
   * The assignment is the assertion. If `pino`'s `Logger` ever stops satisfying
   * `NotificationLogger`, this stops compiling and `check-types` goes red —
   * which is the failure arriving at the seam that owns it rather than at the
   * first call site to try wiring the two together.
   */
  it("is satisfied by @repo/observability's logger", () => {
    const port: NotificationLogger = logger;

    expect(typeof port.info).toBe("function");
    expect(typeof port.warn).toBe("function");
  });
});
