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
 */

import { z } from "zod";

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
const EMAIL = z
  .string()
  .trim()
  .min(1)
  .regex(/^[^\s@]+@[^\s@.]+\.[^\s@]+$/);

/**
 * The form as it arrives. Every field is a string because that is what
 * `FormData` carries — the coercion to a boolean is this schema's job, once,
 * rather than each reader's.
 */
export const requestMagicLinkSchema = z.object({
  email: EMAIL,

  /**
   * `"on"` is what a checked checkbox posts. The hidden field mirrors it
   * explicitly so the value travels with the form even though the control sits
   * outside it — see the form component.
   */
  sharedDevice: z
    .union([z.literal("on"), z.literal("off"), z.undefined()])
    .transform((value) => value === "on"),

  /**
   * Shape only. Whether the path is *safe* is `safeReturnPath`'s question in
   * `@repo/domain`, and it stays there: this module is client-reachable, and an
   * open-redirect rule enforced in a browser is not enforced.
   */
  returnPath: z.string().optional(),
});

export type RequestMagicLinkInput = z.output<typeof requestMagicLinkSchema>;

/**
 * The email rule alone, as a predicate.
 *
 * The browser needs to ask this question about a single field before deciding
 * whether a submit is worth a round trip, and the field validator needs to ask
 * the same one. Exported so both call it rather than each restating the schema.
 */
export function isAcceptableAddress(value: string): boolean {
  return EMAIL.safeParse(value).success;
}

/** The one field a person can get wrong, named so both halves agree on the key. */
export type SignInFieldErrors = Partial<Record<"email", string>>;

/**
 * Parse a `FormData` the way the Server Action does.
 *
 * Exported so the client can run the identical check before spending a round
 * trip, and so the test drives one function rather than two implementations of
 * one rule.
 */
export function parseRequestMagicLink(
  formData: FormData,
): { ok: true; value: RequestMagicLinkInput } | { ok: false; fieldErrors: SignInFieldErrors } {
  const result = requestMagicLinkSchema.safeParse({
    email: formData.get("email") ?? "",
    sharedDevice: formData.get("sharedDevice") ?? undefined,
    returnPath: formData.get("returnPath") ?? undefined,
  });

  if (result.success) return { ok: true, value: result.data };

  // Zod's own messages are English and are not under `docs/policy/voice.md`, so
  // none of them reaches a person. The field is what this maps; the sentence is
  // `messages.ts`'s and the caller's.
  const fieldErrors: SignInFieldErrors = {};
  for (const issue of result.error.issues) {
    if (issue.path[0] === "email") fieldErrors.email = "email";
  }

  return { ok: false, fieldErrors };
}
