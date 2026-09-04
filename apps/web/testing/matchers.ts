/**
 * Custom matchers, registered once for the whole `web` suite.
 *
 * **Why a matcher rather than a helper function.** The parse-then-assert shape
 * this replaces cost three lines for what is conceptually one assertion, and two
 * of the three were *technical detail* — calling `safeParse`, then reaching into
 * `.success` — rather than the intention being tested. A matcher moves that
 * detail behind a name and, more usefully, owns the **failure message**: a bare
 * `expect(schema.safeParse(x).success).toBe(true)` fails with `false is not
 * true`, which tells a reader nothing about which rule refused the value or why.
 *
 * This is the Epic Web "advanced Vitest patterns" custom-matcher exercise
 * applied to the one place in this repo that had the shape it describes.
 */

import type { StandardSchemaV1 } from "@standard-schema/spec";
import { expect } from "vitest";

/**
 * The matcher takes a **Standard Schema**, not a Zod schema, and that is
 * deliberate: nothing here should have an opinion about which validation library
 * the surface under test uses. Zod 4 implements the interface, which is the same
 * property that lets `_lib/schema.ts`'s objects go straight to TanStack Form as
 * validators.
 */
function describeIssues(result: StandardSchemaV1.FailureResult): string {
  return result.issues
    .map((issue) => {
      const path = issue.path?.map((segment) =>
        typeof segment === "object" ? String(segment.key) : String(segment),
      );
      const at = path && path.length > 0 ? `${path.join(".")}: ` : "";
      return `  - ${at}${issue.message}`;
    })
    .join("\n");
}

/**
 * A thenable check rather than `result instanceof Promise`, and a type predicate
 * so the narrowing `instanceof` used to give still happens.
 *
 * **`instanceof` compares constructor identity, which is per-realm, and this
 * suite runs in a VM realm** (`pool: "vmThreads"` in `vitest.config.mts`). A
 * promise built by a module evaluated outside this realm would not match — and
 * the miss would be silent in the worst direction: execution would fall through
 * to the `issues` check, a promise has no `issues`, and the matcher would report
 * a **pass** for a schema it never ran. The thenable contract is what Standard
 * Schema actually specifies and is realm-independent, so the guard fails closed.
 */
function isThenable(value: object): value is PromiseLike<unknown> {
  return typeof (value as { then?: unknown }).then === "function";
}

expect.extend({
  /**
   * Asserts that a value satisfies a schema, and says *which rule* refused it
   * when it does not.
   *
   * Synchronous by construction: a Standard Schema may validate asynchronously,
   * and a matcher that silently accepted a promise would pass on every async
   * schema. One is refused loudly instead.
   */
  toMatchSchema(received: unknown, schema: StandardSchemaV1) {
    const result = schema["~standard"].validate(received);

    if (isThenable(result)) {
      throw new TypeError(
        "toMatchSchema received a schema that validates asynchronously. Await the " +
          "validation and assert on its result rather than passing the schema here.",
      );
    }

    if (result.issues === undefined) {
      return {
        pass: true,
        message: () =>
          `Expected ${this.utils.printReceived(received)} not to match the schema, but it did.`,
      };
    }

    return {
      pass: false,
      message: () =>
        `Expected ${this.utils.printReceived(received)} to match the schema. It was refused by:\n` +
        describeIssues(result),
    };
  },
});

/**
 * The augmentation has to restate Vitest's own type parameters **exactly** —
 * same names, same constraints, same defaults — or declaration merging fails
 * with "All declarations of 'Matchers' must have identical type parameters".
 * There are two of them: `R` is what an assertion returns (`void`, or
 * `Promise<void>` behind `resolves`/`rejects`), and `T` is the type of the
 * value that was passed to `expect`.
 *
 * `T` is deliberately unused here. Constraining the schema by it — say
 * `StandardSchemaV1<T>` — reads like the stronger contract and is the wrong
 * one: the negative cases are the point of this matcher, and they pass a value
 * the schema is *meant* to refuse. `expect(new FormData()).not.toMatchSchema(
 * requestMagicLinkSchema)` would stop compiling, which would delete the
 * assertion rather than tighten it.
 */
declare module "vitest" {
  interface Matchers<R extends void | Promise<void> = void | Promise<void>, T = unknown> {
    toMatchSchema: (schema: StandardSchemaV1) => R;
  }
}
