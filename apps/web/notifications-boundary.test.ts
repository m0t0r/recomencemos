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
