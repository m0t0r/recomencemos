/**
 * What `/sign-in` accepts, declared once and parsed twice.
 *
 * The spec fixes the shape of the server half: _"A Server Action never touches
 * the database. It **authorizes, parses its input once at the boundary**, and
 * calls one domain module"_ — and DD2 says what that parse owes a person:
 * _"the boundary parse produces `fieldErrors` for a person; a `CHECK` is a
 * backstop that must never fire."_ This module is that parse, and the client
 * borrows it so the two cannot disagree.
 *
 * **The server parse is the authoritative one and is not optional.** The client
 * check exists to save her a round trip on a slow connection, nothing more: a
 * Server Action is compiled to a directly reachable POST endpoint, so anything
 * enforced only in the browser is not enforced. Deleting the client half would
 * cost latency; deleting the server half would cost the rule.
 *
 * **This module imports nothing from `@repo/domain`, and that is load-bearing.**
 * It is reached from a Client Component, and `@repo/domain/auth-handler` pulls
 * `#connection` — and `pg` — onto the client graph. That already happened once
 * on this surface and `server-only` refused it at the door.
 *
 * **Every schema here carries its own sentence, and the sentence comes from
 * `./messages`.** ADR-0014's second rule is that no Zod message reaches a
 * person, because Zod's own messages are English and are not under
 * `docs/policy/voice.md`. Importing the sentence from the message module obeys
 * that rule rather than bending it — nothing Zod authored is ever rendered — and
 * it is what lets these schemas be handed to TanStack Form directly as Standard
 * Schemas instead of being re-expressed as bespoke predicates on the field.
 */

import { z } from "zod";
import { EMAIL_LOOKS_WRONG } from "./messages";

/**
 * **Deliberately shallow, and this is the one field where that is a decision
 * rather than laziness.**
 *
 * `z.email()` implements a stricter grammar than this, and stricter is the wrong
 * direction here: it is the *only* door a Worker without a Google account has,
 * and an address wrongly refused is a person locked out of a platform built for
 * her. Real addresses that trip strict validators are not exotic —
 * `ana+trabajo@…`, a long or new TLD, an accented local part, a subdomain nobody
 * expects. The authority on whether an address works is the mail that arrives or
 * does not; this only catches the typo she can still see in the field.
 *
 * So: something, an `@`, something, a dot, something, and no spaces. That
 * refuses `ana`, `ana@`, `@example.co` and `ana @example.co`, and accepts
 * everything a mail server might.
 */
export const emailField = z
  .string()
  .trim()
  .min(1, EMAIL_LOOKS_WRONG)
  .regex(/^[^\s@]+@[^\s@.]+\.[^\s@]+$/, EMAIL_LOOKS_WRONG);

/**
 * The same rule, but silent about an empty field.
 *
 * `onBlur` lets an empty field alone: she has not finished, and telling her an
 * empty box is wrong while she is still filling it in is the form nagging rather
 * than helping. `onSubmit` has no such exemption, so it uses {@link emailField}.
 *
 * Expressed as a schema rather than as a hand-written predicate so that the
 * field validator and the boundary parse are the same *kind* of object — both go
 * to their consumer as Standard Schemas, and neither restates the regex.
 */
export const emailFieldOnBlur = z.union([z.literal(""), emailField]);

/**
 * The fields of the email door, as an object.
 *
 * `sharedDevice` and `returnPath` are **not** here, and their absence is the
 * design: both are bound arguments rather than form fields, so they never
 * existed as hidden inputs and this schema never had to coerce them. See
 * {@link returnPathArg} below, and `../actions.ts` for what binds them.
 */
export const requestMagicLinkFields = z.object({
  email: emailField,
});

/**
 * The same fields, but reached from either shape a caller can arrive in.
 *
 * **next-safe-action does not convert `FormData`** — verified against the
 * installed package rather than assumed: nothing in its `dist` mentions
 * `FormData` at all, so an action driven by `useActionState` receives the raw
 * `FormData` and the schema is what has to accept it. The documented
 * alternative is a `zod-form-data` dependency; this is the same conversion in
 * four lines and no dependency, which is the trade the simplicity lens would
 * ask for on a form with one field.
 *
 * It takes a plain object too, so a direct call and a test do not have to build
 * a `FormData` to exercise the rule.
 */
export const requestMagicLinkSchema = z.preprocess(
  (raw) => (raw instanceof FormData ? { email: raw.get("email") ?? "" } : raw),
  requestMagicLinkFields,
);

export type RequestMagicLinkInput = z.output<typeof requestMagicLinkFields>;

/**
 * The two values that travel with a submit but are not typed into it.
 *
 * **They are bound arguments, and that is what replaced two hidden inputs.** A
 * hidden `<input>` is a value the JSX has to mirror, name correctly, and coerce
 * on the other side — the shared-device field carried a comment explaining that
 * `"on"` had to be spelled the same in two places, which is the shape of problem
 * a bound argument does not have. `action.bind(null, returnPath, sharedDevice)`
 * hands React the values, React encodes them itself, and this schema is what
 * validates them on arrival. Progressive enhancement survives, because a bound
 * argument is part of the action reference React serialises into the form.
 *
 * `returnPath` is checked for **shape only**. Whether the path is *safe* is
 * `safeReturnPath`'s question in `@repo/domain`, and it stays there: this module
 * is client-reachable, and an open-redirect rule enforced in a browser is not
 * enforced.
 */
export const returnPathArg = z.string().optional();
export const sharedDeviceArg = z.boolean();
