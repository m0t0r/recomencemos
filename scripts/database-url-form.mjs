#!/usr/bin/env node
// Whether production will open a pasted database connection string, asked of
// the function production actually runs.
//
// `scripts/go-live.sh` calls this before it stages `DATABASE_URL` or
// `DIRECT_DATABASE_URL` on Fly. Production refuses a string that does not
// require a verified TLS connection when it first resolves one, so a weak string
// staged by the wizard is a release command that fails a stage later, with the
// operator no longer looking at the dashboard the string came from.
//
// **The rule is not restated here.** This runs `@repo/domain`'s own
// `poolConfig` or `directConfig` with `ENVIRONMENT` pinned to `production`, so
// the wizard and the Fly machine cannot disagree about what passes. It is
// pinned rather than read because the operator's shell is a developer's shell,
// and the question being asked is about the machine.
//
// **The string arrives on stdin and is never printed.** An argument would put a
// password in `ps` output and in shell history; a refusal prints the resolver's
// own message, which names the variable and never the value — the seam-1 cases
// beside the resolver pin that.
//
// Usage: printf '%s' "$DATABASE_URL" | node scripts/database-url-form.mjs DATABASE_URL
//
//   0, nothing printed      production will open it
//   1, the refusal on stderr production will refuse it
//   2                        could not reach an answer

import { readFileSync } from "node:fs";
// By path rather than by package name, as `dev-origin.mjs` reads the
// environment reader: the root manifest depends on no workspace, and plain
// `node` strips the types.
import {
  DIRECT_URL_VARIABLE,
  directConfig,
  POOLED_URL_VARIABLE,
  poolConfig,
} from "../packages/domain/src/config.ts";
import { isAppError } from "../packages/errors/src/app-error.ts";

const RESOLVERS = new Map([
  [POOLED_URL_VARIABLE, poolConfig],
  [DIRECT_URL_VARIABLE, directConfig],
]);

const variable = process.argv[2] ?? "";
const resolve = RESOLVERS.get(variable);
if (!resolve) {
  console.error(
    `database-url-form: name the variable being checked, ${POOLED_URL_VARIABLE} or ` +
      `${DIRECT_URL_VARIABLE}${variable ? `; ${variable} is not a connection string` : ""}.`,
  );
  process.exit(2);
}

let value;
try {
  value = readFileSync(0, "utf8");
} catch {
  console.error("database-url-form: could not read the connection string from stdin.");
  process.exit(2);
}

try {
  resolve({ ENVIRONMENT: "production", [variable]: value });
} catch (error) {
  if (isAppError(error)) {
    console.error(error.message);
    process.exit(1);
  }
  // Only the name: an unexpected error's message is not something this script
  // has checked for the string it was handed.
  console.error(
    `database-url-form: could not reach an answer (${error instanceof Error ? error.name : "unknown error"}).`,
  );
  process.exit(2);
}
