/**
 * The boundary parse, tested as one rule rather than as two implementations.
 *
 * The whole reason the schema is shared is that the browser's answer and the
 * server's must be the same answer. Before the rework there were genuinely two
 * things to keep honest — a Zod schema and an `isAcceptableAddress` predicate
 * that restated its regex — and this file drove the predicate. There is now only
 * the schema: TanStack Form validates with the very object the Server Action
 * parses with, so a divergence is no longer something a test has to catch
 * because it is no longer something that can be written.
 *
 * What is still worth pinning is the rule itself, and the two properties of the
 * `FormData` boundary that a caller could break without noticing.
 */

import {
  emailField,
  emailFieldOnBlur,
  requestMagicLinkFields,
  requestMagicLinkSchema,
  returnPathArg,
  sharedDeviceArg,
} from "./schema";
import { EMAIL_LOOKS_WRONG } from "./messages";

describe("emailField", () => {
  // The point of the shallowness. Each of these is a real address that a
  // stricter validator has been known to refuse, and refusing one locks a Worker
  // out of the only door she has.
  it.each([
    "ana@example.co",
    "ana+trabajo@example.co",
    "ana.maria@example.com.co",
    "ana@correo.example.co",
    "anamaría@example.co",
    "a@b.co",
    "ana@example.tecnologia",
  ])("accepts %o", (address) => {
    expect(address).toMatchSchema(emailField);
  });

  // The typo she can still see in the field, and nothing beyond it.
  it.each(["", "   ", "ana", "ana@", "@example.co", "ana @example.co", "ana@example", "ana@.co"])(
    "refuses %o",
    (address) => {
      expect(address).not.toMatchSchema(emailField);
    },
  );

  it("ignores space she did not mean to type", () => {
    expect(emailField.parse("  ana@example.co  ")).toBe("ana@example.co");
  });

  /**
   * ADR-0014's second rule, as an assertion rather than as a convention.
   *
   * Nothing Zod authored may reach a person, so every refusal this schema can
   * produce has to carry the sentence from `./messages`. This is the check that
   * makes the schemas safe to hand to TanStack Form as validators at all — the
   * form renders `issue.message` directly, so an English default here would be
   * rendered in Spanish copy.
   */
  it.each(["", "ana", "ana@example"])("refuses %o in her language, not Zod's", (address) => {
    const result = emailField.safeParse(address);

    expect(result.success).toBe(false);
    if (result.success) return;

    for (const issue of result.error.issues) {
      expect(issue.message).toBe(EMAIL_LOOKS_WRONG);
    }
  });
});

describe("emailFieldOnBlur", () => {
  // She has not finished typing. Telling her an empty box is wrong while she is
  // still filling it in is the form nagging rather than helping.
  it("lets an empty field alone", () => {
    expect("").toMatchSchema(emailFieldOnBlur);
  });

  it("still refuses a wrong-shaped address", () => {
    expect("ana").not.toMatchSchema(emailFieldOnBlur);
  });
});

describe("requestMagicLinkSchema", () => {
  /**
   * **next-safe-action does not convert `FormData`**, so this preprocessing step
   * is the only thing standing between a native form submit and a parse failure
   * on every request. It is asserted rather than assumed because the failure
   * mode is total and silent in type-checking: `useActionState` hands the action
   * a `FormData`, and a schema expecting an object would refuse every one of
   * them as a validation error the surface renders as "revisa el correo".
   */
  it("parses what a native form posts", () => {
    const posted = new FormData();
    posted.append("email", "  ana@example.co ");

    expect(requestMagicLinkSchema.parse(posted)).toEqual({ email: "ana@example.co" });
  });

  // Taken as an object too, so a direct call and a test do not have to build a
  // `FormData` to exercise the rule.
  it("parses a plain object", () => {
    expect({ email: "ana@example.co" }).toMatchSchema(requestMagicLinkSchema);
  });

  it("refuses a form carrying no address at all", () => {
    expect(new FormData()).not.toMatchSchema(requestMagicLinkSchema);
  });

  /**
   * The fields object is what the form's own validators and the action's
   * `parsedInput` type are built from; the preprocessing wrapper is only the
   * `FormData` door. Pinning that they agree stops the two drifting into a state
   * where the browser validates one shape and the server parses another.
   */
  it("agrees with the fields it wraps", () => {
    expect({ email: "ana@example.co" }).toMatchSchema(requestMagicLinkFields);
    expect({ email: "ana" }).not.toMatchSchema(requestMagicLinkFields);
  });
});

describe("the bound arguments", () => {
  // Shape only. Whether the path is *safe* is `safeReturnPath`'s question in
  // `@repo/domain`, and this must not look like it has been answered here.
  it("passes returnPath through without judging it", () => {
    expect("//evil.co").toMatchSchema(returnPathArg);
  });

  it("allows returnPath to be absent", () => {
    expect(undefined).toMatchSchema(returnPathArg);
  });

  /**
   * **`sharedDevice` is a boolean, and that is the whole point of the move to a
   * bound argument.** It used to arrive as the string a checkbox posts, which
   * meant the surface had to spell `"on"` the same way the schema read it and a
   * test had to pin both spellings. React serialises the boolean now, so there
   * is one representation and this schema refuses anything else.
   */
  it.each([true, false])("takes a real boolean (%o)", (value) => {
    expect(value).toMatchSchema(sharedDeviceArg);
  });

  it.each(["on", "off", undefined, 1])("refuses %o, which is not a boolean", (value) => {
    expect(value).not.toMatchSchema(sharedDeviceArg);
  });
});
