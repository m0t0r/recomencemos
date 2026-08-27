// @vitest-environment node

/**
 * NFR24, which is otherwise a rule enforced by nobody.
 *
 * It says two things. Every environment variable this effort introduces is
 * **declared** — build-baked values in `env` on `build`, runtime-only ones in
 * `globalPassThroughEnv`, because Turborepo runs in `strict` environment mode
 * and an undeclared variable is filtered out of a task's environment entirely.
 * And **no runtime credential appears in any turbo task at all**, because
 * `.env*` files are a `build` input, so a credential declared on a task is a
 * credential hashed into a cache key that travels with a remote-cached artifact.
 *
 * `turbo build --dry` prints the resolved definitions and is how a person
 * checks. That is exactly the problem: it is a command somebody has to remember
 * to run, on a file two other tickets are about to edit. This is the same
 * obligation as a table, run by CI.
 *
 * **It lives here rather than in `packages/`** for the reason
 * `domain-boundary.test.ts` does: the claim is about the repository as a
 * deployed whole, and `apps/web` is the workspace that is deployed. Node's
 * environment, not happy-dom, because it reads files.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

const read = (relativePath: string): string =>
  readFileSync(new URL(relativePath, `file://${repoRoot}`), "utf8");

const turboJson = read("turbo.json");
const flyToml = read("fly.toml");

/**
 * `fly.toml` with its comments removed.
 *
 * The file **names** `DATABASE_URL` and `DIRECT_DATABASE_URL` in prose, to say
 * which connection the release command runs on and why. A scan of the raw text
 * refuses that comment, which is the same false positive `gate-lib.sh` handles
 * with `strip_heredocs` — a gate that refuses the sentence documenting a rule
 * teaches people to stop writing the sentence. What is being asserted is that
 * no credential is **set** here, so the comments come out first.
 */
const flyTomlSettings = flyToml
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("#"))
  .join("\n");

const turbo = JSON.parse(turboJson) as {
  globalPassThroughEnv?: string[];
  tasks: Record<string, { env?: string[]; passThroughEnv?: string[] }>;
};

/**
 * The ten runtime credentials NFR24 names, verbatim from the spec. Each reaches
 * the app through `fly secrets` and is needed by no turbo task — a build never
 * connects to the database, never sends an email, and never signs a webhook.
 *
 * Written out rather than matched by a `/SECRET|TOKEN|KEY/` heuristic on
 * purpose: `SENTRY_AUTH_TOKEN` is a credential that a task legitimately needs,
 * so a heuristic would have to carve out an exception and would then be one
 * exception away from admitting the next one.
 */
const RUNTIME_CREDENTIALS = [
  "DATABASE_URL",
  "DIRECT_DATABASE_URL",
  "RESEND_API_KEY",
  "RESEND_WEBHOOK_SECRET",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "BETTER_AUTH_SECRET",
  "JOB_SHARED_SECRET",
];

/** Every environment key any turbo task declares, in one list, with its source. */
function declaredEnvKeys(): { key: string; where: string }[] {
  const found: { key: string; where: string }[] = [];

  for (const key of turbo.globalPassThroughEnv ?? []) {
    found.push({ key, where: "globalPassThroughEnv" });
  }

  for (const [task, definition] of Object.entries(turbo.tasks)) {
    for (const key of definition.env ?? []) found.push({ key, where: `${task}.env` });
    for (const key of definition.passThroughEnv ?? []) {
      found.push({ key, where: `${task}.passThroughEnv` });
    }
  }

  return found;
}

/**
 * `fly.toml`'s `[env]` table, which is the other half of "the deploy path
 * declares its environment". Parsed with a reader rather than a TOML dependency:
 * one table of flat `KEY = "value"` lines is not worth a package, and a parser
 * that silently accepted something else would be the failure mode here.
 */
function flyEnvKeys(): string[] {
  const table = flyTomlSettings.match(/^\[env\]\n([\s\S]*?)(?=^\[|Z)/m);
  if (!table?.[1]) return [];

  return table[1]
    .split("\n")
    .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=/)?.[1])
    .filter((key): key is string => Boolean(key));
}

describe("NFR24 — every variable is declared, and no runtime credential is", () => {
  it.each(RUNTIME_CREDENTIALS)("%s appears in no turbo task", (credential) => {
    const declarations = declaredEnvKeys().filter(({ key }) => key === credential);

    expect(
      declarations.map(({ where }) => where),
      `${credential} is a runtime credential and reaches the app through \`fly secrets\`. ` +
        "`.env*` is a `build` input, so declaring it on a task hashes it into the cache key.",
    ).toEqual([]);
  });

  it.each(RUNTIME_CREDENTIALS)("%s appears nowhere in fly.toml", (credential) => {
    expect(
      flyTomlSettings.includes(credential),
      `${credential} must be set with \`fly secrets set\`, which keeps it out of the repository. ` +
        "`fly.toml` is committed.",
    ).toBe(false);
  });

  /**
   * The one credential a task does need, and the whole point of it being
   * `passThroughEnv` on **one** task: `dev`, `lint`, `test` and `check-types`
   * have no use for a write-scoped Sentry token, and `passThroughEnv` keeps its
   * value out of the hash the way `env` would not.
   */
  it("SENTRY_AUTH_TOKEN is passed through to web#build and to nothing else", () => {
    expect(declaredEnvKeys().filter(({ key }) => key === "SENTRY_AUTH_TOKEN")).toEqual([
      { key: "SENTRY_AUTH_TOKEN", where: "web#build.passThroughEnv" },
    ]);
  });

  /**
   * The coupling that actually breaks in practice. `web#build` **replaces** the
   * base `build` task rather than merging with it, so a variable added to
   * `build.env` and not to `web#build.env` is silently absent from the only
   * build that ships — which under `strict` environment mode means the app is
   * built without it rather than warned about it.
   */
  it("web#build declares every build variable the base build task does", () => {
    const base = turbo.tasks.build?.env ?? [];
    const web = turbo.tasks["web#build"]?.env ?? [];

    expect(base.filter((key) => !web.includes(key))).toEqual([]);
  });

  /**
   * `fly.toml`'s `[env]` is runtime configuration, so every key in it that any
   * workspace reads has to be a declared pass-through — otherwise it works on
   * the deployed machine and is filtered out of `pnpm dev`, which is the kind of
   * difference that gets diagnosed as a framework bug.
   *
   * `PORT` is the exception and is named rather than pattern-matched: it is
   * Fly's own contract with the container, read by the Next server and by no
   * turbo task.
   */
  it("every fly.toml [env] key is declared as a turbo pass-through", () => {
    const platformOwned = new Set(["PORT"]);
    const passThrough = new Set(turbo.globalPassThroughEnv ?? []);

    const undeclared = flyEnvKeys().filter(
      (key) => !platformOwned.has(key) && !passThrough.has(key),
    );

    expect(undeclared).toEqual([]);
  });
});
