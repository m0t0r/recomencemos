/**
 * The matcher's own guard, pinned.
 *
 * `toMatchSchema` is synchronous by construction: a Standard Schema is allowed
 * to validate asynchronously, and the failure mode of accepting one quietly is
 * the worst available — a promise carries no `issues`, so the matcher would
 * report a **pass** for a schema it never actually ran. Every case here is about
 * that one refusal, because it is the only path in the matcher that cannot
 * announce itself through a normal assertion failure.
 */

import type { StandardSchemaV1 } from "@standard-schema/spec";

/** A schema that accepts everything, synchronously. */
const ACCEPTS: StandardSchemaV1 = {
  "~standard": {
    version: 1,
    vendor: "test",
    validate: (value) => ({ value }),
  },
};

/** A schema that refuses everything, synchronously, with one issue. */
const REFUSES: StandardSchemaV1 = {
  "~standard": {
    version: 1,
    vendor: "test",
    validate: () => ({ issues: [{ message: "no", path: ["field"] }] }),
  },
};

/**
 * The regression case. `then` on a plain object is what a promise from **another
 * realm** looks like to `instanceof Promise` — false — and this suite runs in a
 * VM realm (`pool: "vmThreads"`). The guard is written against the thenable
 * contract for this reason, so this schema must be refused exactly as a native
 * promise is. Against an `instanceof` guard it falls through and reports a pass.
 */
const ASYNC_FROM_ANOTHER_REALM = {
  "~standard": {
    version: 1,
    vendor: "test",
    // `unicorn/no-thenable` is right in general and wrong here: an object with a
    // `then` is precisely the thing under test, and the rule firing is the rule
    // describing the hazard this guard exists to catch. Disabled for the one
    // line rather than for the file or the repo.
    // oxlint-disable-next-line unicorn/no-thenable
    validate: () => ({ then: (resolve: (value: unknown) => void) => resolve({ value: 1 }) }),
  },
} as unknown as StandardSchemaV1;

/** The same refusal, through a real promise. */
const ASYNC: StandardSchemaV1 = {
  "~standard": {
    version: 1,
    vendor: "test",
    validate: () => Promise.resolve({ value: 1 }),
  },
};

describe("toMatchSchema", () => {
  it("passes a value the schema accepts", () => {
    expect({ any: "thing" }).toMatchSchema(ACCEPTS);
  });

  it("fails a value the schema refuses, and names the rule that refused it", () => {
    expect("anything").not.toMatchSchema(REFUSES);

    // The failure message is the reason this is a matcher rather than a helper,
    // so it is asserted rather than assumed.
    expect(() => expect("anything").toMatchSchema(REFUSES)).toThrow("field: no");
  });

  it.for([
    ["a native promise", ASYNC],
    ["a thenable from another realm", ASYNC_FROM_ANOTHER_REALM],
  ] as const)("refuses %s rather than reporting a pass", ([, schema]) => {
    expect(() => expect(1).toMatchSchema(schema)).toThrow(TypeError);
    expect(() => expect(1).toMatchSchema(schema)).toThrow("validates asynchronously");
  });
});
