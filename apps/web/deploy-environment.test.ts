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
const deployWorkflow = read(".github/workflows/deploy.yml");
const deployScript = read("scripts/deploy.sh");
const dockerfile = read("Dockerfile");
const dockerignore = read(".dockerignore");

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
  /**
   * The lookahead ends the table at the next TOML header **or at end of input**.
   * `\Z` is not a JavaScript anchor — written as one it is the literal letter
   * `Z`, which happens to work only because `[http_service]` follows `[env]`
   * today. Move `[env]` last and the match returns `null`, and a parser that
   * returns `[]` on no-match makes the assertion below pass having checked
   * nothing. That is the fail-open shape `CLAUDE.md` calls out in
   * `audit-direct.mjs`, so it throws instead.
   */
  const table = flyTomlSettings.match(/^\[env\]\n([\s\S]*?)(?=^\[|$(?![\s\S]))/m);

  if (!table?.[1]) {
    throw new Error(
      "fly.toml has no readable `[env]` table. This test cannot tell an empty table " +
        "from a parser that stopped matching, so it refuses rather than reporting a pass.",
    );
  }

  return table[1]
    .split("\n")
    .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=/)?.[1])
    .filter((key): key is string => Boolean(key));
}

// NFR24, both halves of it.
describe("every variable is declared on a turbo task, and no runtime credential is", () => {
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
   * NFR25's release stamp reaches the running process through the **image**, not
   * through `fly.toml` or a `--env` flag, so `flyEnvKeys()` above will never see
   * it and this is the assertion that covers that channel. Both halves matter:
   * the `Dockerfile` must turn the build argument into an image `ENV`, and
   * `deploy.sh` must not also pass it per-deploy — re-supplied from `HEAD`, it
   * would stamp the current commit onto a rolled-back older image.
   */
  it("NEXT_PUBLIC_RELEASE travels in the image and is not passed per-deploy", () => {
    expect(dockerfile).toMatch(/^ENV NEXT_PUBLIC_RELEASE=\$NEXT_PUBLIC_RELEASE$/m);
    expect(deployScript).not.toMatch(/--env "NEXT_PUBLIC_RELEASE/);
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
  /**
   * The guard on the guard: an assertion over a list is only as good as the list,
   * and the one above is the only thing reading it.
   */
  it("the fly.toml [env] reader finds the keys that are in the file", () => {
    expect(flyEnvKeys()).toEqual(expect.arrayContaining(["LOG_FORMAT", "LOG_LEVEL", "PORT"]));
  });

  it("every fly.toml [env] key is declared as a turbo pass-through", () => {
    const platformOwned = new Set(["PORT"]);
    const passThrough = new Set(turbo.globalPassThroughEnv ?? []);

    const undeclared = flyEnvKeys().filter(
      (key) => !platformOwned.has(key) && !passThrough.has(key),
    );

    expect(undeclared).toEqual([]);
  });
});

/**
 * `release-branch` in `docs/policy/build.md`, and NFR25 as amended at #9.
 *
 * The requirement is one sentence — **`main` is deployed and `dev` is not** — and
 * it is enforced in two places that have to agree: the workflow's trigger and
 * the script's own guard. Either one alone is a hole. A trigger widened to `dev`
 * would make every merged ticket a production release, which is exactly the
 * thing the amendment moved away from, and it is a one-word edit that reviews
 * cleanly.
 */
describe("the deploy runs from the release branch and nowhere else", () => {
  it("deploy.yml triggers on a push to main only", () => {
    const pushTrigger = deployWorkflow.match(
      /on:\n(?:.*\n)*?\s+push:\n\s+branches:\s*\[([^\]]*)\]/,
    );

    expect(pushTrigger?.[1]?.split(",").map((branch) => branch.trim())).toEqual(["main"]);
  });

  it("deploy.sh names main as the release branch", () => {
    expect(deployScript).toMatch(/^RELEASE_BRANCH="main"$/m);
  });

  /**
   * The escape hatch has to stay an escape hatch. A guard that reads
   * `DEPLOY_ALLOW_BRANCH` from anywhere other than the environment — a default,
   * a file, a flag the workflow could pass — is a guard the deploy path can
   * satisfy on its own.
   */
  it("the branch guard's only override is an environment variable", () => {
    expect(deployScript).toMatch(/\$\{DEPLOY_ALLOW_BRANCH:-\}" != "1"/);
    expect(deployWorkflow).not.toMatch(/DEPLOY_ALLOW_BRANCH/);
  });

  /**
   * The Fly token is write-scoped to the app, so it is a credential in the sense
   * NFR24 means: it belongs in `secrets`, never inline and never in a `vars`
   * entry, which GitHub renders in plain text on the settings page and in logs.
   */
  it("FLY_API_TOKEN is read from secrets and appears nowhere else", () => {
    expect(deployWorkflow).toMatch(/FLY_API_TOKEN:\s*\$\{\{\s*secrets\.FLY_API_TOKEN\s*\}\}/);
    expect(deployWorkflow).not.toMatch(/vars\.FLY_API_TOKEN/);
    expect(deployWorkflow).not.toMatch(/FlyV1/);
  });
});

/**
 * The three findings from `/security-review` on #9, each as the assertion that
 * would have caught it. All three are one-word regressions — a `**\/` dropped, a
 * `USER` line deleted as noise, an `env -u` tidied out of a `CMD` — and none of
 * them fails anything at build or at deploy. They fail silently, in production,
 * and only under an attacker.
 */
describe("the production image does not hand an attacker more than it must", () => {
  /**
   * Docker matches `.dockerignore` against the whole context-relative path, so a
   * bare `.env` excludes `./.env` and nothing else. The only `.env.local` this
   * repo has is `apps/web/.env.local` — `next dev` reads it from its own project
   * directory — so the root-anchored form excluded nothing that exists, while
   * `fly deploy` builds on a **remote** builder. A developer's `RESEND_API_KEY`
   * was being uploaded into a builder layer cache.
   */
  it(".dockerignore excludes env files at every depth, not just the root", () => {
    expect(dockerignore).toMatch(/^\*\*\/\.env$/m);
    expect(dockerignore).toMatch(/^\*\*\/\.env\.\*$/m);
    // The committed example carries no secret and is what a reader copies from.
    expect(dockerignore).toMatch(/^!\*\*\/\.env\.example$/m);
  });

  /**
   * `node:24-slim` defaults to UID 0. As root, an arbitrary-write bug in the
   * Next server also rewrites `server.js` — persistence across restarts — and
   * reads `/proc/1/environ`, where Fly's init holds every secret.
   */
  it("the runner drops to the unprivileged user the base image ships", () => {
    expect(dockerfile).toMatch(/^USER node$/m);
  });

  /**
   * Fly secrets are app-wide, so `DIRECT_DATABASE_URL` — the role that inherits
   * `postgres` and can run DDL — reaches every process unless something takes it
   * away. The request path uses the pooled connection and has no use for it; the
   * release command is a separate command on a separate machine and still gets
   * it. Without this the least-privilege split between the two database roles is
   * undone at the process, and `exports`-map enforcement (ADR-0010) is worth
   * nothing to code that is already executing.
   */
  it("the server process is started without the migration credential", () => {
    expect(dockerfile).toMatch(
      /^CMD \["env", "-u", "DIRECT_DATABASE_URL", "node", "apps\/web\/server\.js"\]$/m,
    );
  });
});
