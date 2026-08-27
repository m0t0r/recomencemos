"use server";

/**
 * `requestMagicLink` — the email door's one Server Action.
 *
 * **It authorizes independently**, which for this action means something worth
 * stating rather than skipping: the surface is public, so there is no principal
 * to check — and the reason the API contract still says *every* Server Action
 * authorizes independently is that Next compiles each one to a directly
 * reachable POST endpoint, so a page-level check never extends to it. What this
 * action owes instead of a principal check is everything below: it validates its
 * own input, charges its own ceiling, and validates `returnPath` itself rather
 * than trusting the page that rendered the form.
 *
 * **It answers `{ ok: true }` whatever happened to the address.** An address with
 * an Account and one without produce the same reply and the same sentence on
 * screen, because the honest reply and the enumeration-safe reply are the same
 * one. See `RequestMagicLinkOutcome` in `@repo/domain/auth-handler` for the one
 * case that is not `ok` and why reporting it discloses nothing.
 */

import type { ClientError } from "@repo/errors/app-error";
import { MAGIC_LINK_TTL_MINUTES } from "@repo/domain/auth-handler";
import { rateLimit } from "@repo/domain/rate-limit";
import { logRequestError } from "@repo/observability/log-request-error";
import { headers } from "next/headers";
import { auth } from "../../lib/auth";
import { checkYourEmail, EMAIL_LOOKS_WRONG } from "./messages";
import { parseRequestMagicLink } from "./schema";

/**
 * What the form gets back.
 *
 * `retryAfter` is a field of its own rather than something dug out of the error,
 * because NFR26's third half is that a refusal is **legible to the person who
 * hit it** — the surface renders the `userMessage` and the seconds, and a shape
 * that made the seconds optional-and-buried is a shape where the surface quietly
 * stops rendering them.
 */
export type RequestMagicLinkState =
  | { readonly status: "idle" }
  | { readonly status: "sent"; readonly message: string }
  | { readonly status: "field_error"; readonly message: string }
  | { readonly status: "rate_limited"; readonly message: string; readonly retryAfter: number }
  | { readonly status: "failed"; readonly error: ClientError };

/**
 * The client IP, for NFR26's per-IP half.
 *
 * `x-forwarded-for` is a list and the **first** entry is the client; Fly's proxy
 * appends. It is the same header `advanced.ipAddress.ipAddressHeaders` names,
 * and the reason both read it is that this ceiling and Better Auth's are two
 * different counters on two different doors.
 */
function clientIp(requestHeaders: Headers): string | undefined {
  const forwarded = requestHeaders.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || undefined;
}

export async function requestMagicLink(
  _previous: RequestMagicLinkState,
  formData: FormData,
): Promise<RequestMagicLinkState> {
  // **The boundary parse** (spec `## Solution`, DD2). One schema, shared with the
  // browser so the two cannot disagree — and re-run here because a Server Action
  // is a directly reachable POST endpoint, so the client's copy is a courtesy and
  // this one is the rule.
  const parsed = parseRequestMagicLink(formData);

  if (!parsed.ok) {
    return { status: "field_error", message: EMAIL_LOOKS_WRONG };
  }

  const { email, sharedDevice, returnPath } = parsed.value;

  const requestHeaders = await headers();

  // Charged before anything is sent, and charged against both principals NFR26
  // names. The address bound is the real one; the IP bound is what stops the
  // address bound being defeated by rotating addresses.
  const byAddress = await rateLimit.chargeCeiling(
    { scope: "address", id: email },
    "requestMagicLink",
  );

  if (!byAddress.allowed) {
    return {
      status: "rate_limited",
      message: byAddress.error.userMessage,
      retryAfter: byAddress.retryAfter,
    };
  }

  const ip = clientIp(requestHeaders);
  if (ip) {
    const byIp = await rateLimit.chargeCeiling({ scope: "ip", id: ip }, "requestMagicLink");

    if (!byIp.allowed) {
      return {
        status: "rate_limited",
        message: byIp.error.userMessage,
        retryAfter: byIp.retryAfter,
      };
    }
  }

  const outcome = await auth().requestMagicLink({
    email,
    sharedDevice,
    returnPath,
    headers: requestHeaders,
  });

  if (!outcome.ok) {
    // Returned, not thrown, so it costs one `warn` line and no Sentry event —
    // CLAUDE.md's "thrown is reported; returned is logged". She still gets a
    // real sentence and her address stays in the field.
    logRequestError(outcome.error, { level: "warn" });
    return { status: "failed", error: outcome.error.toClientError() };
  }

  return { status: "sent", message: checkYourEmail(MAGIC_LINK_TTL_MINUTES) };
}
