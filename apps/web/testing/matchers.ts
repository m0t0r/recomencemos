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

    if (result instanceof Promise) {
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

interface SchemaMatchers<R = unknown> {
  toMatchSchema: (schema: StandardSchemaV1) => R;
}

declare module "vitest" {
  interface Matchers<T = any> extends SchemaMatchers<T> {}
}
