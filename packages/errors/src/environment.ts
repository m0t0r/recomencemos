/**
 * Where this process is running, read in one place (ADR-0022).
 *
 * `NODE_ENV` answers how the process was **built** — Next sets it from the
 * command, so a local `next start` and CI's `next build` both read as
 * production. Every "is this production?" decision in this repository asks this
 * reader instead, and nothing of ours compares `NODE_ENV` to decide one.
 *
 * **Unset reads as development, and production does not rely on that.** The
 * default serves the developer, who never sets anything — and it keeps HSTS off
 * `*.localhost`. Production gets the variable from the `Dockerfile`, in the stage
 * that builds and the stage that runs, where `deploy-environment.test.ts` pins it.
 * Two mechanisms, because a single default could not serve both.
 *
 * **In `@repo/errors` because it is pure and needs nothing.** Every package that
 * makes such a decision already depends on this one, and the module adds no
 * dependency to it. The environment is always a parameter rather than a
 * `process.env` default, because this package is isomorphic — and in a browser
 * bundle `ENVIRONMENT` is not inlined, so it would read as development. That is
 * why browser Sentry still reads `NODE_ENV`.
 */

import { AppError } from "@repo/errors/app-error";

export const ENVIRONMENT_VARIABLE = "ENVIRONMENT";

/**
 * A closed set. `staging` is added when a staging app exists, not before — and
 * until then a caller that asks "is this development?" rather than "is this
 * production?" is the one that will refuse it by default.
 */
export type Environment = "development" | "production";

/**
 * An environment record: `process.env`, or a test's literal. An index signature
 * rather than the one key, because `process.env` declares no `ENVIRONMENT` and a
 * type listing only that key would share no property with it.
 */
export type EnvironmentRecord = Readonly<Record<string, string | undefined>>;

/** Enough of a refused value to recognise the typo; a log line does not need the rest. */
const MAX_QUOTED_LENGTH = 64;

/**
 * The environment `env` names.
 *
 * **Anything outside the set throws**, `prod` included. Read as either of the
 * two, a typo would be silently wrong in one direction or the other — HSTS
 * pinned on a developer's browser, or a production machine refusing nothing.
 * Stopping the process is the only answer right in both places.
 */
export function readEnvironment(env: EnvironmentRecord): Environment {
  const value = env[ENVIRONMENT_VARIABLE]?.trim();

  if (!value) return "development";
  if (value === "development" || value === "production") return value;

  throw new AppError({
    code: "environment_unknown",
    status: 500,
    message:
      `${ENVIRONMENT_VARIABLE} is ${JSON.stringify(value.slice(0, MAX_QUOTED_LENGTH))}, which ` +
      "is not an environment this app knows. Set it to development or production, or leave " +
      "it unset for development. The production image sets it in the Dockerfile.",
    context: { variable: ENVIRONMENT_VARIABLE, value: value.slice(0, MAX_QUOTED_LENGTH) },
  });
}
