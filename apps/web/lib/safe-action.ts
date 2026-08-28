import "server-only";

/**
 * The one action client, and the bridge between two error vocabularies.
 *
 * Every Server Action in this app is built from `actionClient`. What that buys
 * over a hand-written action is the three things story 1 wrote by hand and eight
 * later surfaces would each have written again: the boundary parse, a composable
 * middleware chain for the ceilings, and one shape for what comes back.
 *
 * **`next-safe-action` owns the envelope; `AppError` stays the currency.** The
 * library's own convention is a `serverError` of whatever `handleServerError`
 * returns, and this repo already has an answer for what a browser may see —
 * `ClientError`, the three-key whitelist in `@repo/errors`. So the bridge is one
 * function, written once here, and the audience split (`message` for an
 * operator, `userMessage` for a person) survives it rather than being restated
 * per action. There is deliberately no path from `message` to `serverError`.
 *
 * **Progressive enhancement is why actions are built with `.stateAction()`.**
 * next-safe-action's own form guide marks `useAction` and `useStateAction` as
 * *not* working without JavaScript, and `useActionState` as the one that does —
 * because the first two wrap the action in a client closure and React can then
 * no longer emit the no-JS form encoding. A `.stateAction()` is a real server
 * action reference, so `useActionState(action, init)` keeps NFR4 reachable.
 * ADR-0014's third rule is the same rule; this is the library-shaped way to obey
 * it. Do not swap `useActionState` for `useStateAction` to gain the callbacks.
 */

import { AppError, type ClientError, projectClientError } from "@repo/errors/app-error";
import {
  type CeilingedAction,
  type CeilingPrincipal,
  ceilings,
  type CeilingScope,
} from "@repo/domain/rate-limit";
import { logRequestError } from "@repo/observability/log-request-error";
import {
  createSafeActionClient,
  createValidatedMiddleware,
  returnServerError,
} from "next-safe-action";
import { headers } from "next/headers";

/**
 * What a failed action puts on the wire.
 *
 * `ClientError`'s three keys, plus the one field a ceiling adds. `retryAfter` is
 * a field of its own rather than something dug out of the message, because
 * NFR26's third half is that a refusal is **legible to the person who hit it** —
 * C39 asks the surface to render the sentence *and* the number, and a shape that
 * buried the seconds is a shape where the surface quietly stops rendering them.
 */
export type ActionError = ClientError & { readonly retryAfter?: number };

/**
 * The typed alias the supporting docs recommend over bare `returnServerError`.
 *
 * `returnServerError<SE>` infers `SE` from its argument, so nothing type-checks
 * the payload against what the client believes `serverError` is. Routing every
 * expected failure through this alias is what makes the two agree.
 */
export const returnActionError: (error: ActionError) => never = returnServerError;

/**
 * **Thrown is reported; returned is logged**, and this is the boundary where
 * that rule is applied for every action at once.
 *
 * An error that reaches here was *thrown*, so it is unexpected by definition and
 * has earned its Sentry event — `logRequestError` at its default level reports
 * it. An error a handler chose to return travels through
 * {@link returnActionError} instead, which bypasses this function entirely
 * (the library sets `serverError` directly), costs one `warn` line and no event.
 * That is the only quota lever in the design, and it is now a property of which
 * function a handler calls rather than something each handler remembers.
 *
 * The projection is `projectClientError`, not a field copy: the value narrowed
 * by `isAppError` may merely *claim* to be one, and that projection reads fields
 * and validates each rather than invoking a method on it.
 */
function handleServerError(error: Error): ActionError {
  logRequestError(error);
  return projectClientError(error);
}

export const actionClient = createSafeActionClient({ handleServerError });

/**
 * Who NFR26's per-IP half is charged against.
 *
 * **`Fly-Client-IP` first**, because it is set by Fly's proxy to the address it
 * actually observed, is always a single value, and cannot be chosen by the
 * caller — the same reason `#auth/config` puts it first for Better Auth's own
 * limiter, so the two resolvers agree on who a request is.
 *
 * The `x-forwarded-for` fallback reads the **last entry, not the first**: that
 * header is a list each proxy *appends* to, so the leftmost entry is whatever
 * the original caller sent, and charging it would make the ≤ 20/hour bound
 * defeatable by putting a fresh value in a header. With one trusted proxy in
 * front, the rightmost entry is the only one nobody downstream can choose.
 *
 * **An absent header charges a shared bucket rather than skipping the charge.**
 * NFR26 says the counter *fails closed*, and returning "no principal" here used
 * to mean the per-IP ceiling silently did not apply — so stripping the header
 * removed the bound entirely. Every header-less caller now shares one counter:
 * bounded together, which is the closed answer, and harmless in development
 * where there is no proxy and one person.
 */
const NO_PROXY_PRINCIPAL = "no-forwarded-for";

export function clientIp(requestHeaders: Headers): string {
  const flyClientIp = requestHeaders.get("fly-client-ip")?.trim();
  if (flyClientIp) return flyClientIp;

  const forwarded = requestHeaders.get("x-forwarded-for");
  if (!forwarded) return NO_PROXY_PRINCIPAL;

  const hops = forwarded
    .split(",")
    .map((hop) => hop.trim())
    .filter(Boolean);

  return hops.at(-1) ?? NO_PROXY_PRINCIPAL;
}

/**
 * How an action names the principals its ceiling is charged against.
 *
 * The `ip` scope needs nothing from the caller — the middleware reads the
 * headers itself. The `address` scope needs a value only the action's own input
 * carries, so the caller supplies a selector over its parsed input. That is why
 * this is `useValidated` middleware and not `use`: the address principal does
 * not exist until the input has been parsed, and a malformed address should cost
 * the ceiling nothing.
 */
export interface RateLimitOptions<Input> {
  readonly action: CeilingedAction;
  readonly principals: readonly {
    readonly scope: CeilingScope;
    readonly id?: (input: Input) => string;
  }[];
}

/**
 * NFR26's ceilings, as one middleware every action opts into by naming them.
 *
 * **A refusal is returned, never thrown**, which is NFR26's second half: an
 * `AppError` raised on every refusal would let a crawler spend the month's
 * 5,000-event Sentry allowance in a day and make the second real incident of the
 * month invisible. `returnActionError` is the mechanism — it bypasses
 * {@link handleServerError} and so costs one `warn` line and no event.
 *
 * **Charges are sequential on purpose.** A refusal on the first principal must
 * not charge the second, or the address bound would consume the IP bound's
 * budget on requests that never happened.
 */
export function rateLimit<Input extends object>({ action, principals }: RateLimitOptions<Input>) {
  return createValidatedMiddleware<{ parsedInput: Input }>().define(
    async ({ parsedInput, next }) => {
      const requestHeaders = await headers();

      for (const principal of principals) {
        const charged: CeilingPrincipal = {
          scope: principal.scope,
          id: principal.id ? principal.id(parsedInput) : clientIp(requestHeaders),
        };

        // Sequential on purpose — see the note above.
        // oxlint-disable-next-line no-await-in-loop
        const outcome = await ceilings.charge(charged, action);

        if (outcome.allowed) continue;

        // Returned, not thrown: one `warn` line, no Sentry event. The `AppError`
        // the ceiling carries is the operator half; only `userMessage` crosses.
        logRequestError(outcome.error, { level: "warn" });

        return returnActionError({
          ...outcome.error.toClientError(),
          retryAfter: outcome.retryAfter,
        });
      }

      return next();
    },
  );
}

export { AppError };
