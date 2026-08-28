/**
 * `feedbackFor` — the one rule inside `use-sign-in.ts` rather than the wiring
 * around it.
 *
 * **Why this and not `renderHook`.** The hook's `useActionState` bindings, its
 * bound arguments and its focus effect all run for real in
 * `_components/sign-in-form.test.tsx`, thirty tests deep, against the component
 * that renders them — re-asserting them through `renderHook` would pin the
 * wiring twice and the behaviour no further. What that suite cannot show cheaply
 * is the *ordering*: it renders one outcome at a time, so a rule about which of
 * five outcomes wins when two are true at once is invisible there. It is stated
 * as prose in the function's doc comment and, until this file, asserted nowhere.
 *
 * The order under test, highest first:
 *
 * 1. `data.sent` — a link went out
 * 2. `serverError` — the action refused, with `retryAfter` splitting a ceiling
 *    from a transport fault
 * 3. `validationErrors` — the server rejected the address
 * 4. `consumedLink` — she arrived on an already-used link
 * 5. `googleFailed` — she came back from Google with `?error=`
 *
 * 1–3 are what the action just returned; 4–5 are what a redirect brought her
 * here with. The whole point of the ordering is that the first group outranks
 * the second, so a retry's outcome replaces the reason she arrived.
 */

/**
 * **`../actions` is replaced for a resolution reason, not a behavioural one.**
 * `feedbackFor` is pure and touches no action — but `use-sign-in.ts` imports the
 * two of them so `SignInResult` can be derived from what `requestMagicLink`
 * returns, and that module reaches `@/lib/auth`, which carries
 * `import "server-only"`. Vite cannot resolve that specifier outside the
 * `react-server` layer (ADR-0013, mechanism 2), so the import graph has to be
 * cut before it gets there. Nothing below asserts anything about either function.
 */
vi.mock("../actions", () => ({ requestMagicLink: vi.fn(), startGoogleSignIn: vi.fn() }));

import {
  CHECK_YOUR_EMAIL_HINT,
  EMAIL_LOOKS_WRONG,
  GOOGLE_FAILED,
  LINK_ALREADY_USED,
  SEND_FAILED_HINT,
} from "./messages";
import { feedbackFor, type SignInResult } from "./use-sign-in";

/** Nothing has happened and she arrived cleanly — the empty case. */
const NOTHING: SignInResult = {};
const FRESH = { consumedLink: false, googleFailed: false };

const SENT: SignInResult = { data: { sent: true, message: "Te enviamos un enlace." } };
/**
 * `serverError` is an `ActionError`, which is `ClientError`'s three keys plus the
 * one a ceiling adds. `code` and `requestId` are carried here because the type
 * requires them and because that is what the client actually receives — but
 * nothing below asserts on either: what this function decides is the *sentence*
 * and the *tone*, and a test that pinned a `requestId` would be pinning the
 * envelope rather than the rule.
 */
const CEILING: SignInResult = {
  serverError: {
    code: "rate_limited",
    message: "Puedes pedir otro en 27 minutos",
    requestId: "req_ceiling",
    retryAfter: 1_620,
  },
};
const TRANSPORT_FAULT: SignInResult = {
  serverError: {
    code: "notification_failed",
    message: "No pudimos enviarlo.",
    requestId: "req_fault",
  },
};
const REJECTED: SignInResult = {
  validationErrors: { email: { _errors: ["rejected by the server"] } },
};

describe("nothing to say", () => {
  it("returns undefined when nothing has happened and she arrived cleanly", () => {
    expect(feedbackFor(NOTHING, FRESH)).toBeUndefined();
  });
});

describe("what the action returned", () => {
  it("reports a sent link as a success, with the hint that tells her where to look", () => {
    expect(feedbackFor(SENT, FRESH)).toEqual({
      tone: "success",
      message: "Te enviamos un enlace.",
      hint: CHECK_YOUR_EMAIL_HINT,
    });
  });

  /**
   * **A ceiling carries its number and no hint; a transport fault carries a hint
   * and no number.** The two are told apart by `retryAfter` being present, not by
   * a status code or a string match — `lib/safe-action.ts` puts the field there
   * for exactly this read. The ceiling's own sentence already names her count and
   * when the window resets, so a hint would be a second, vaguer answer beside it.
   */
  it("reports a ceiling with its retryAfter and no hint", () => {
    expect(feedbackFor(CEILING, FRESH)).toEqual({
      tone: "problem",
      message: "Puedes pedir otro en 27 minutos",
      retryAfter: 1_620,
    });
  });

  it("reports a transport fault with a hint and no retryAfter", () => {
    expect(feedbackFor(TRANSPORT_FAULT, FRESH)).toEqual({
      tone: "problem",
      message: "No pudimos enviarlo.",
      hint: SEND_FAILED_HINT,
    });
  });

  /**
   * The operator's `_errors` string never reaches her. She sees the schema's own
   * sentence — `docs/policy/voice.md`'s — whatever the server called the problem,
   * which is the `message`/`userMessage` split holding at this seam too.
   */
  it("shows the voice guide's sentence for a server rejection, not the server's", () => {
    expect(feedbackFor(REJECTED, FRESH)).toEqual({
      tone: "problem",
      message: EMAIL_LOOKS_WRONG,
    });
  });
});

describe("what a redirect brought her here with", () => {
  // Not written as an error: a link scanner opening it first is our problem, and
  // the next thing on screen is a resend.
  it("treats a consumed link as a success", () => {
    expect(feedbackFor(NOTHING, { consumedLink: true, googleFailed: false })).toEqual({
      tone: "success",
      message: LINK_ALREADY_USED,
    });
  });

  it("treats a Google failure as a problem", () => {
    expect(feedbackFor(NOTHING, { consumedLink: false, googleFailed: true })).toEqual({
      tone: "problem",
      message: GOOGLE_FAILED,
    });
  });
});

/**
 * **The ordering itself, which is the reason this file exists.** Each case sets
 * two outcomes true at once and names which one wins. Every pair here is
 * reachable: she can retry on the `/sign-in` a consumed link dropped her on, and
 * she can retry after coming back from Google with an error.
 */
describe("which outcome wins when two are true", () => {
  const ARRIVED_BADLY = { consumedLink: true, googleFailed: false };
  const BACK_FROM_GOOGLE = { consumedLink: false, googleFailed: true };

  it.each([
    ["a sent link", SENT, ARRIVED_BADLY, "Te enviamos un enlace."],
    ["a ceiling", CEILING, ARRIVED_BADLY, "Puedes pedir otro en 27 minutos"],
    ["a server rejection", REJECTED, ARRIVED_BADLY, EMAIL_LOOKS_WRONG],
    ["a sent link", SENT, BACK_FROM_GOOGLE, "Te enviamos un enlace."],
    ["a ceiling", CEILING, BACK_FROM_GOOGLE, "Puedes pedir otro en 27 minutos"],
    ["a server rejection", REJECTED, BACK_FROM_GOOGLE, EMAIL_LOOKS_WRONG],
  ] as const)("%s outranks how she arrived", (_label, result, arrival, expected) => {
    expect(feedbackFor(result, arrival)?.message).toBe(expected);
  });

  /*
    There is deliberately no case pairing `data` with `validationErrors`.
    next-safe-action's `SafeActionResult` is a discriminated union in which the
    two are mutually exclusive, so that state is unrepresentable rather than
    merely unlikely — `check-types` refuses to build the fixture. The ordering
    between them inside `feedbackFor` is unreachable code kept for the reader,
    and a test asserting it would have to cast past the type to invent a result
    the action cannot return.
  */

  // And within the arrival cases, a consumed link outranks a Google error: the
  // link is the more specific thing that just happened to her.
  it("puts a consumed link above a Google failure", () => {
    expect(feedbackFor(NOTHING, { consumedLink: true, googleFailed: true })?.message).toBe(
      LINK_ALREADY_USED,
    );
  });
});
