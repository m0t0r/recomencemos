/**
 * The one rule on the Skill-request path: which sentence a person reads, and
 * whether it interrupts.
 *
 * Three of the four cases are refusals somebody can provoke on purpose, and each
 * carries a sentence written somewhere else — the ceiling's by NFR26's refusal
 * table, the rejected fragment's by this surface, the expired session's by the
 * domain. What is tested here is that none of them is thrown away and replaced
 * with the generic one, which is the mistake that would leave a Worker reading
 * "no pudimos enviar tu solicitud" when what actually happened was that she asked
 * five times today.
 */

import type { ActionError } from "@/lib/safe-action";
import { noticeFor } from "./skill-request-notice";
import { SKILL_REQUEST_FAILED, SKILL_REQUEST_SENT } from "./messages";
import { SKILL_REQUEST_REFUSED_CODE } from "./codes";

/**
 * `ClientError`'s three keys plus the one a ceiling adds — the whole of what
 * reaches a browser, built here rather than mocked, so a key added to that
 * whitelist shows up as a type error in this file rather than as a branch nobody
 * exercises.
 */
const refusal = (code: string, message: string, retryAfter?: number) => ({
  serverError: {
    code,
    message,
    requestId: "req-1",
    ...(retryAfter === undefined ? {} : { retryAfter }),
  } satisfies ActionError,
});

it("says nothing before anything has happened", () => {
  expect(noticeFor({})).toBeUndefined();
});

it("says it arrived, and does not interrupt", () => {
  expect(noticeFor({ data: { requested: true } })).toEqual({
    message: SKILL_REQUEST_SENT,
    refused: false,
  });
});

/**
 * The ceiling, told apart by `retryAfter` rather than by a status code. Its
 * sentence is the one the spec singles out — she is mid-publish — so passing it
 * through unchanged is the whole job.
 */
it("passes the ceiling's own sentence through", () => {
  const ceiling = refusal("rate_limited", "Pediste 5 capacidades hoy…", 3600);

  expect(noticeFor(ceiling)).toEqual({ message: "Pediste 5 capacidades hoy…", refused: true });
});

it("passes the rejected fragment's sentence through", () => {
  const rejected = refusal(SKILL_REQUEST_REFUSED_CODE, "Esta línea tiene un número: «300…».");

  expect(noticeFor(rejected)?.message).toBe("Esta línea tiene un número: «300…».");
});

it("passes the expired session's sentence through", () => {
  const expired = refusal("session_required", "Tu sesión ya no está abierta.");

  expect(noticeFor(expired)?.message).toBe("Tu sesión ya no está abierta.");
});

/**
 * A fault gets our sentence rather than the transport's, which is the same rule
 * `feedbackFor` follows for the publishing form: whatever broke, what she needs
 * to know is that her form is still complete.
 */
it("answers a fault in our own words", () => {
  const fault = refusal("something_broke", "Internal Server Error");

  expect(noticeFor(fault)).toEqual({ message: SKILL_REQUEST_FAILED, refused: true });
});
