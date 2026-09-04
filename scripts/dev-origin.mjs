#!/usr/bin/env node
// The origin this worktree's dev server is actually reached at, asked of the
// proxy rather than assumed.
//
// **Why anything needs this.** `pnpm dev` runs `next dev` as a child of the
// named local proxy, so the app learns its own origin from `PORTLESS_URL` and
// every absolute URL it builds follows the hostname the browser really reached.
// A command run from a second terminal is not a child of anything: it sees the
// static `BETTER_AUTH_URL` in `apps/web/.env.local`, which under the proxy is an
// origin nothing is served on, and in a worktree cannot be right for two trees
// at once because the hostname carries the branch.
//
// `pnpm admin:enrol` is the command that suffers for it, because the one thing
// it prints is a link somebody has to open. Before this, the operator had to
// copy the hostname off the `pnpm dev` banner and pass it back in by hand — a
// step that is easy to skip and whose only symptom is a setup link that resolves
// nowhere, several seconds after a database round trip has already minted the
// token it carries.
//
// **The answer comes from the proxy's own client, twice, and the second call is
// the one that matters.** `portless get <name>` builds the hostname with the
// same code path `pnpm dev` used to register it, worktree prefix and all, so the
// two cannot disagree about what this tree's server would be called. But it
// answers whether a proxy is running, not whether *this* app is behind it — it
// prints a URL just as happily when nothing is serving. `portless list` is what
// says the route exists, and the difference is exactly the `PORTLESS=0 pnpm dev`
// case: back on a plain port, no route is registered, and the configured
// variable is then the right answer rather than the stale one.
//
// **The name is read from the app's manifest rather than written down here.**
// It is declared once, in the `portless` block the proxy itself reads, and a
// second copy in this file would be a copy that goes wrong silently the day
// somebody renames the app.
//
// Three exit codes:
//
//   0 + a URL on stdout    the proxy has a route for this tree's dev server
//   0 + nothing on stdout  it has none, which is an answer and not a failure
//   2                      could not reach an answer at all
//
// The empty answer is deliberately not an error. No dev server, a server started
// with the proxy bypassed, and a server belonging to a different worktree are
// all ordinary states, and in every one of them the caller should fall back to
// the configured origin. What is on stderr in that case is a note naming the
// hostname that was looked for, because a route registered under a *different*
// name is the one case where the fallback is not what the operator expected.
//
// stdout carries the URL and nothing else, which is a contract rather than a
// style: the caller is a command substitution, so a note printed there would
// become the origin a setup link is built against.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

// Anything that stops the script reaching an answer, as against an answer of
// "there is no route".
class LookupError extends Error {}

const DEFAULT_APP = "apps/web";

function parseArgs(argv) {
  const options = { app: resolve(process.cwd(), DEFAULT_APP) };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === "--app") {
      const value = argv[i + 1];
      if (value === undefined) throw new LookupError("--app needs a value");
      options.app = resolve(value);
      i += 1;
      continue;
    }
    throw new LookupError(`unknown argument: ${flag}`);
  }
  return options;
}

/**
 * The name this app registers with the proxy.
 *
 * Only the `portless` block in `package.json` is read, and its absence refuses
 * rather than falling back to the proxy's own default of the directory name.
 * The default would usually be right and would be wrong silently — this command
 * exists to stop a link pointing somewhere nothing is served, so guessing the
 * hostname is the one thing it must not do.
 */
function proxiedName(app) {
  const manifest = join(app, "package.json");
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(manifest, "utf8"));
  } catch {
    throw new LookupError(`no readable manifest at ${manifest}`);
  }

  const name = parsed.portless?.name;
  if (typeof name !== "string" || name.trim() === "") {
    throw new LookupError(`${manifest} declares no "portless" name for the dev server`);
  }
  return name.trim();
}

/**
 * The proxy's client, taken from the app's own `node_modules` rather than from
 * `PATH`.
 *
 * It is pinned exactly as a dependency of that workspace so every tree installs
 * the same one, and a globally installed copy of another version is precisely
 * the thing that would make one worktree's answer differ from another's.
 */
function client(app) {
  return join(app, "node_modules", ".bin", "portless");
}

/**
 * **`NO_COLOR` is set for the child, and it is load-bearing rather than tidy.**
 * The client colourises when `FORCE_COLOR` is in its environment, which is a
 * thing dev shells and CI images set, and it wraps the arrow in the route line
 * in escapes when it does. Piping both streams happens to switch colour off
 * today, but that is an inference about the client's stdio test rather than
 * anything it promises; `NO_COLOR` is the promise, and it is read ahead of
 * `FORCE_COLOR` and ahead of any stdio test. Without it a coloured line matches
 * nothing, which reads as "no route" — the stale link this script exists to
 * stop, arrived at silently and with a note saying the opposite of what
 * happened.
 */
function ask(app, args) {
  try {
    return execFileSync(client(app), args, {
      cwd: app,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, NO_COLOR: "1" },
    });
  } catch (error) {
    throw new LookupError(`\`portless ${args.join(" ")}\` did not answer: ${error.message}`);
  }
}

// Belt and braces on the paragraph above: the escapes are stripped before the
// line is read, so the parse holds even if a later release colours a line it
// was asked not to. Two cheap defences rather than one, because the way this
// fails is by quietly answering "no route".
//
// A control character is the thing being matched — `ESC [ … m` is what a colour
// sequence is, and there is no spelling of it that does not name the escape.
// oxlint-disable-next-line no-control-regex
const ANSI = /\x1b\[[0-9;]*m/g;

// `portless list` prints one indented line per route: the URL, an arrow, the
// port it forwards to, and whose it is. Only the URL is wanted, and it is
// matched whole — a worktree's hostname is the main checkout's with a branch
// prepended, so a containment test would answer yes to the wrong tree.
const ROUTE_LINE = /^\s*(https?:\/\/\S+)\s+->\s/;

function activeRoutes(app) {
  return ask(app, ["list"])
    .replace(ANSI, "")
    .split("\n")
    .map((line) => ROUTE_LINE.exec(line)?.[1])
    .filter((url) => url !== undefined);
}

function main() {
  const { app } = parseArgs(process.argv.slice(2));

  // **A production invocation is answered with nothing, and it is answered
  // quietly.** The same command enrols an Admin against a deployed database,
  // run from a shell by whoever holds the migration credential — and that shell
  // is often a laptop with a dev server up, whose route would otherwise be
  // adopted and print a setup link at a `.localhost` host that reads a different
  // database entirely. `authBaseUrl` carries the identical guard for the
  // identical reason; this one exists because it is cheaper to refuse to look
  // than to look and be overruled, and because on a machine with no dev
  // dependencies looking at all writes a refusal the operator has to interpret.
  if (process.env.NODE_ENV === "production") return;

  const url = ask(app, ["get", proxiedName(app)])
    .replace(ANSI, "")
    .trim();

  if (url === "") throw new LookupError("the proxy named no URL for this app");

  if (!activeRoutes(app).includes(url)) {
    process.stderr.write(`No active route for ${url} — the configured origin stands.\n`);
    return;
  }

  process.stdout.write(`${url}\n`);
}

try {
  main();
} catch (error) {
  // **The consequence is stated, not just the cause.** The caller is a command
  // substitution, which collapses this exit code and an empty answer into the
  // same empty string — so `2` is a signal to a person reading the terminal and
  // to nothing else, and a person needs to be told that the link they are about
  // to be shown was built the other way.
  process.stderr.write(
    `The dev origin could not be resolved: ${error.message}\n` +
      "Anything asking for it falls back to the configured origin.\n",
  );
  process.exit(2);
}
