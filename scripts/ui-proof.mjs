#!/usr/bin/env node
// Publish the captures a Build session took, and link them from the pull
// request. The decision this serves is in `docs/adr/0019-*.md`; the craft of
// taking a capture is the `ui-proof` skill; this is only the pipe between them.
//
// **The report is generated from the pull request body, never authored beside
// it.** That is the whole reason this script exists rather than a paragraph
// telling a session to write an HTML page: two documents describing one change
// drift, and the one nobody is reviewing drifts first. The body is fetched, and
// GitHub renders it — `POST /markdown` is the same renderer the pull request
// itself uses, so the report cannot disagree with the page it came from, and no
// Markdown dependency enters this repository to make that true.
//
// **The media is what the body cannot hold.** GitHub strips `<video>` from
// Markdown and blocks video served from raw URLs, so a page we serve is the only
// place a reviewer can scrub a recording. Everything else — the prose, the
// structural diff sketch — stays in the body, renders natively, and lives in git.
//
// **Two prefixes, because two artifacts have different lifetimes.** `review/`
// expires by the bucket's own lifecycle rule; `demos/` does not. Which one a file
// lands under is read off its name rather than decided here: the skill's naming
// table is what a session already followed, so this script needs no judgement and
// cannot disagree with the session that produced the files.
//
// **Three exit codes.** `0` published (or reported what it would publish), `1` a
// refusal the caller must act on — nothing captured, a name it cannot read, a
// credential absent — and `2` this script failing to run at all. The third exists
// so a broken publish cannot be mistaken for a clean one.
//
// Output goes through `process.stdout.write` for the reason `CLAUDE.md` gives:
// the console is not an output channel here, and this runs outside the
// application that has a logger.

import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { execFile } from "node:child_process";
// Statically imported and cheap: the object-store client is a dynamic import
// inside that module, so this costs nothing on the paths that never upload.
import { missingConfig } from "./ui-proof-store.mjs";

/**
 * `execFile`, and the child's stdin closed on every call.
 *
 * **`promisify(execFile)` has no `input` option, and passing one is silent.**
 * `input` belongs to `execFileSync`/`spawnSync`; the async form ignores an
 * option it does not know, and `execFile` opens stdin as a pipe whatever the
 * caller passes — so a `gh` call that reads `-` sat on a pipe nothing would ever
 * write to or close, and waited forever. Measured, not deduced: the publisher
 * logged all three `gh` calls, printed the durable-clip warning and then stopped
 * with an empty upload log, which read as a hang in the object-store client and
 * was a `cat` blocked on stdin two processes away. `promisify(execFile)("cat",
 * [], { input: "x" })` reproduces it on its own, with no repository involved.
 *
 * So the input is written to the handle rather than handed to the options bag,
 * and a call with no input still gets its stdin ended — a child that inherits an
 * open pipe it is waiting on is the same hang by another route.
 */
const run = (file, args, options = {}) =>
  new Promise((resolve, reject) => {
    const { input, ...rest } = options;
    const child = execFile(file, args, rest, (error, stdout, stderr) => {
      if (error) reject(error);
      else resolve({ stdout, stderr });
    });
    // A child that exits without reading raises EPIPE here, and that is its
    // business rather than ours: the callback above already carries the exit
    // code, and an unhandled stream error would replace it with a crash.
    child.stdin.on("error", () => {});
    child.stdin.end(input ?? "");
  });

const out = (s) => process.stdout.write(s);
const err = (s) => process.stderr.write(s);

/** Files a capture may be. Anything else in the directory is ignored, not refused. */
const MEDIA = new Map([
  [".webm", { kind: "video", type: "video/webm" }],
  [".mp4", { kind: "video", type: "video/mp4" }],
  [".png", { kind: "image", type: "image/png" }],
  [".jpg", { kind: "image", type: "image/jpeg" }],
  [".jpeg", { kind: "image", type: "image/jpeg" }],
  [".gif", { kind: "image", type: "image/gif" }],
]);

/**
 * The three states the skill's naming table defines. `before` and `after` are one
 * comparison and expire together; `demo` is a story and is kept. The state is the
 * first `-`-separated word, so a demo named `after-` is a demo that expires —
 * which is why the skill says so beside the table rather than leaving it implied.
 */
const STATES = new Set(["before", "after", "demo"]);

/** `review/` expires under the bucket's lifecycle rule; `demos/` has no rule. */
const PREFIX = { before: "review", after: "review", demo: "demos" };

/**
 * `<state>-<surface>.<ext>` — the skill's naming rule, read rather than guessed.
 * Returns `null` for a file this script has no opinion about, and throws only
 * where the name is *almost* right, because a capture named `beofre-form.webm`
 * is a session's typo rather than an unrelated file and silently ignoring it
 * would publish half a comparison.
 */
export function classify(filename) {
  const ext = extname(filename).toLowerCase();
  const media = MEDIA.get(ext);
  if (!media) return null;

  const stem = basename(filename, extname(filename));
  const dash = stem.indexOf("-");
  if (dash < 1) {
    throw new Error(
      `"${filename}" is a capture with no state: expected <state>-<surface>${ext}, where <state> is before, after or demo`,
    );
  }

  const state = stem.slice(0, dash);
  const surface = stem.slice(dash + 1);
  if (!STATES.has(state)) {
    throw new Error(
      `"${filename}" starts with "${state}", which is not one of before, after or demo`,
    );
  }
  if (!surface) {
    throw new Error(`"${filename}" names a state but no surface`);
  }
  // The link block records the surfaces as a ", "-joined list so the expiry step
  // can read them back after the artifact is gone. A surface carrying that exact
  // separator would split into two on the way back, so it is refused here rather
  // than corrupting a body nobody re-reads.
  if (surface.includes(", ")) {
    throw new Error(
      `"${filename}" has a surface containing ", ", which the link block cannot round-trip`,
    );
  }

  return { file: filename, state, surface, kind: media.kind, type: media.type, ext };
}

/**
 * Group captures the way a reviewer reads them: a comparison is a before and an
 * after of one surface, side by side. An unpaired half is kept rather than
 * dropped — a session that captured only a before is a session whose PR body has
 * to say why, and hiding the file here would take that decision away from it.
 */
export function group(entries) {
  const bySurface = new Map();
  for (const e of entries) {
    if (e.state === "demo") continue;
    const slot = bySurface.get(e.surface) ?? { surface: e.surface };
    slot[e.state] = e;
    bySurface.set(e.surface, slot);
  }
  return {
    comparisons: [...bySurface.values()].toSorted((a, b) => a.surface.localeCompare(b.surface)),
    demos: entries
      .filter((e) => e.state === "demo")
      .toSorted((a, b) => a.file.localeCompare(b.file)),
  };
}

/**
 * Where an artifact lands. Both prefixes carry the pull request number and a
 * random segment: the number so a human can find it, and the random segment so
 * the URL is unguessable, which is the only thing standing between a public
 * bucket and someone enumerating every artifact this repository has produced.
 * The demo prefix carries one too — it is the artifact that never expires, so it
 * is the one a guessable name exposes for longest.
 */
export function prefixFor(state, pullRequest, nonce) {
  return `${PREFIX[state]}/pr-${pullRequest}-${nonce}`;
}

// Every attribute this file writes is double-quoted, so `'` is not strictly
// required — it is escaped anyway, because the rule "safe as long as nobody
// writes a single-quoted attribute" is one a later edit breaks silently.
const escapeHtml = (s) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

// **Absolute, always.** A relative `src` resolves against the page, and the page
// lives under one prefix while the demos live under another — so every demo
// player on the review report resolved into `review/…` and 404'd. Found by
// review, not by running it, because a fixture directory has no origin to
// resolve against.
const mediaTag = (e, url) =>
  e.kind === "video"
    ? `<video controls preload="metadata" playsinline src="${escapeHtml(url)}"></video>`
    : `<img loading="lazy" alt="${escapeHtml(e.surface)}, ${escapeHtml(e.state)}" src="${escapeHtml(url)}">`;

/**
 * The viewer. Deliberately small: the prose above it is the pull request body
 * rendered by GitHub, and everything this adds is the part a pull request body
 * physically cannot show.
 *
 * **`bodyHtml` is inserted unescaped, and that trust is load-bearing.** It is
 * whatever `POST /markdown` returned, and GitHub sanitises its own output — that
 * is the same guarantee the pull request page itself relies on. Said out loud
 * because the page is served from an origin of ours rather than GitHub's, so a
 * future change that renders Markdown any other way inherits an injection this
 * one does not have.
 */
export function renderReport({ title, bodyHtml, comparisons, demos, urlFor }) {
  const half = (e, label) =>
    e
      ? `<figure><figcaption>${label}</figcaption>${mediaTag(e, urlFor(e))}</figure>`
      : `<figure class="missing"><figcaption>${label}</figcaption><p>Not captured. The pull request body says why.</p></figure>`;

  const comparisonHtml = comparisons
    .map(
      (c) =>
        `<section class="pair"><h3>${escapeHtml(c.surface)}</h3><div class="side-by-side">${half(c.before, "Before")}${half(c.after, "After")}</div></section>`,
    )
    .join("");

  const demoHtml = demos.length
    ? `<h2>The story, working</h2>${demos
        .map(
          (d) =>
            `<section class="demo"><h3>${escapeHtml(d.surface)}</h3>${mediaTag(d, urlFor(d))}</section>`,
        )
        .join("")}`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escapeHtml(title)}</title>
<style>
:root { color-scheme: light dark; --fg: #16150f; --bg: #fbfaf7; --muted: #6b6558; --line: #e2ded4; }
@media (prefers-color-scheme: dark) { :root { --fg: #f2efe8; --bg: #16150f; --muted: #a09884; --line: #322e26; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.6 ui-sans-serif, system-ui, sans-serif; }
main { max-width: 68rem; margin: 0 auto; padding: 2rem 1.25rem 6rem; }
h1 { font-size: 1.5rem; line-height: 1.25; }
h2 { margin-top: 3rem; padding-top: 1.5rem; border-top: 1px solid var(--line); }
.body :is(pre, table) { overflow-x: auto; max-width: 100%; }
.body table { border-collapse: collapse; }
.body :is(td, th) { border: 1px solid var(--line); padding: .35rem .6rem; text-align: left; }
.body pre { background: color-mix(in srgb, var(--fg) 6%, transparent); padding: .75rem; border-radius: .5rem; }
.body img { max-width: 100%; }
.side-by-side { display: grid; gap: 1rem; grid-template-columns: 1fr; }
@media (min-width: 48rem) { .side-by-side { grid-template-columns: 1fr 1fr; } }
figure { margin: 0; }
figcaption { color: var(--muted); font-size: .8125rem; text-transform: uppercase; letter-spacing: .04em; margin-bottom: .4rem; }
:is(video, img) { width: 100%; border: 1px solid var(--line); border-radius: .5rem; background: color-mix(in srgb, var(--fg) 4%, transparent); }
.missing p { color: var(--muted); border: 1px dashed var(--line); border-radius: .5rem; padding: 1.5rem; margin: 0; }
.demo video { max-width: 26rem; }
footer { color: var(--muted); font-size: .8125rem; margin-top: 4rem; }
</style>
</head>
<body>
<main>
<h1>${escapeHtml(title)}</h1>
<div class="body">${bodyHtml}</div>
<h2>Recorded proof</h2>
${comparisonHtml || "<p>No before/after comparison was captured.</p>"}
${demoHtml}
<footer>Generated from the pull request body. The prose is the pull request's; this page adds only what a pull request body cannot show.</footer>
</main>
</body>
</html>
`;
}

/**
 * The link block, fenced by markers so it is idempotent: publishing twice edits
 * one block rather than appending a second, and the workflow that runs when the
 * pull request closes can find exactly what to rewrite. Without the markers the
 * expiry step would be a regular expression over prose somebody had since edited.
 */
const BEGIN = "<!-- ui-proof:begin -->";
const END = "<!-- ui-proof:end -->";

export function withBlock(body, inner) {
  const block = `${BEGIN}\n${inner}\n${END}`;
  const start = body.indexOf(BEGIN);
  const finish = body.indexOf(END);
  if (start !== -1 && finish > start) {
    return body.slice(0, start) + block + body.slice(finish + END.length);
  }
  return `${body.trimEnd()}\n\n${block}\n`;
}

/**
 * What the artifact showed, carried in a comment rather than parsed back out of
 * the sentence. The expiry step has to name it after the artifact is gone, and
 * recovering it by regular expression over prose a human may since have edited is
 * how that step would quietly start writing "expired. It showed ." instead.
 */
const SHOWED = /<!-- ui-proof:showed (.*?) -->/;
const DEMO = /<!-- ui-proof:demo (\S+) -->/;

/**
 * Two lines, because there are two lifetimes and the reader has to be able to
 * tell which link is which. The review link is the one that stops working; the
 * demo link is the one that does not, so it survives the expiry rewrite intact.
 *
 * "after it was published" rather than "after this pull request closes", which
 * is what this said before: an object-store lifecycle rule counts from upload,
 * and a pull request open three weeks would otherwise have promised nine more
 * days than it had.
 */
export const linkBlock = ({ url, surfaces, demoUrl, demoSurfaces }) =>
  `<!-- ui-proof:showed ${surfaces.join(", ")} -->\n` +
  (demoUrl ? `<!-- ui-proof:demo ${demoUrl} -->\n` : "") +
  `**Recorded proof** — [${surfaces.join(", ")}, in a player you can scrub](${url}) · expires 30 days after it was published` +
  (demoUrl ? `\n\n**The story, kept** — [${demoSurfaces.join(", ")}](${demoUrl})` : "");

// The comment is carried forward rather than consumed, so expiring is idempotent:
// a pull request closed, reopened and closed again rewrites the same notice
// instead of degrading it to "expired." with nothing left to name.
/**
 * What the pull request says once the review is over. It is deliberately not the
 * word "gone": the rewrite runs when the pull request closes, and the object
 * itself ages out 30 days after it was published — so at this moment the file
 * usually still exists and only the link has been withdrawn. Saying "expired"
 * here would have been a sentence that is false for a month.
 */
export const expiredBlock = (surfaces, demoUrl) =>
  (surfaces.length > 0 ? `<!-- ui-proof:showed ${surfaces.join(", ")} -->\n` : "") +
  (demoUrl ? `<!-- ui-proof:demo ${demoUrl} -->\n` : "") +
  `**Recorded proof** — no longer linked${
    surfaces.length > 0 ? `. It showed ${surfaces.join(", ")}` : ""
  }. A review artifact is removed from the store 30 days after it was published.` +
  (demoUrl ? `\n\n**The story, kept** — [this one does not expire](${demoUrl})` : "");

export function surfacesIn(body) {
  const found = SHOWED.exec(body);
  return found?.[1] ? found[1].split(", ").filter(Boolean) : [];
}

export function demoUrlIn(body) {
  return DEMO.exec(body)?.[1];
}

const gh = async (args, input) => {
  const { stdout } = await run("gh", args, {
    input,
    maxBuffer: 32 * 1024 * 1024,
  });
  return stdout;
};

async function main(argv) {
  const args = new Map();
  let command = argv[0];
  for (let i = 1; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split("=");
      args.set(k, v ?? (argv[i + 1]?.startsWith("--") === false ? argv[++i] : "true"));
    }
  }

  if (command !== "publish" && command !== "expire") {
    err("usage: ui-proof.mjs <publish|expire> --pr <number> [--dry-run]\n");
    return 2;
  }

  const pullRequest = args.get("pr");
  if (!pullRequest || !/^\d+$/.test(pullRequest)) {
    err("ui-proof: --pr <number> is required\n");
    return 2;
  }
  const dryRun = args.has("dry-run");

  // Expiry is the other half of the retention answer, and it runs where the agent
  // is not: the session ended at "pull request opened", and a merge happens hours
  // or days later. The bucket's lifecycle rule is what deletes; this only rewrites
  // the line that linked it, so a merged pull request does not spend the rest of
  // its life pointing at a 404. It needs no credential for the store at all.
  if (command === "expire") {
    const body = JSON.parse(await gh(["pr", "view", pullRequest, "--json", "body"])).body ?? "";
    if (!body.includes(BEGIN)) {
      out(`ui-proof: pull request #${pullRequest} links no artifact — nothing to expire\n`);
      return 0;
    }
    const next = withBlock(body, expiredBlock(surfacesIn(body), demoUrlIn(body)));
    if (dryRun) {
      out(next.slice(next.indexOf(BEGIN), next.indexOf(END) + END.length) + "\n");
      return 0;
    }
    await gh(["pr", "edit", pullRequest, "--body-file", "-"], next);
    out(`ui-proof: marked the artifact on pull request #${pullRequest} expired\n`);
    return 0;
  }

  let root;
  try {
    root = (await run("git", ["rev-parse", "--show-toplevel"])).stdout.trim();
  } catch {
    err("ui-proof: not inside a git worktree\n");
    return 2;
  }

  // Absolute, derived from the tree this process is actually in. A relative path
  // here is the failure `CLAUDE.md` names: it resolves against the main checkout
  // and `.artifacts/` is gitignored at any depth, so the mistake leaves no trace.
  const dir = join(root, ".artifacts", "ui-proof");

  let names;
  try {
    names = await readdir(dir);
  } catch {
    err(`ui-proof: nothing captured — ${dir} does not exist\n`);
    return 1;
  }

  let entries;
  try {
    entries = names.map(classify).filter(Boolean);
  } catch (e) {
    err(`ui-proof: ${e.message}\n`);
    return 1;
  }

  if (entries.length === 0) {
    err(`ui-proof: nothing captured — no media under ${dir}\n`);
    return 1;
  }

  // A capture too small to be one is refused rather than published. This is the
  // `ffmpeg` failure seen from the other end: `record start` reports success and
  // `record stop` is where it breaks, so the plausible wreckage is a truncated or
  // empty file rather than a missing one — and an empty file publishes as a
  // player that shows nothing, which reads to a reviewer as a change that does
  // nothing. Observed while rendering a fixture: a 120-byte "image" renders as a
  // blank frame with a caption above it and no error anywhere on the page.
  //
  // Every file is measured once, here, and the size travels on the entry: the
  // dry run prints it and the upload passes it to S3 as a content length, and
  // statting the same file three times would be three chances to disagree.
  const TOO_SMALL = 1024;
  const sizes = await Promise.all(entries.map((e) => stat(join(dir, e.file))));
  entries.forEach((e, i) => {
    e.size = sizes[i].size;
  });
  const truncated = entries.filter((e) => e.size < TOO_SMALL).map((e) => e.file);
  if (truncated.length > 0) {
    err(
      `ui-proof: ${truncated.join(", ")} — under ${TOO_SMALL} bytes, so not a capture. A recording that ended without ffmpeg leaves exactly this; re-take it rather than publishing a player that shows nothing\n`,
    );
    return 1;
  }

  const { comparisons, demos } = group(entries);

  const nonce = randomNonce();
  const reviewPrefix = prefixFor("after", pullRequest, nonce);
  const demoPrefix = prefixFor("demo", pullRequest, nonce);
  const keyFor = (e) => `${e.state === "demo" ? demoPrefix : reviewPrefix}/${e.file}`;

  // --dry-run answers "what would be published", which is the object list and the
  // link. It deliberately reaches nothing: no pull request, no markdown renderer,
  // no credential — so the naming, the grouping and the two prefixes are drivable
  // from a fixture directory on a machine that has no bucket and no network.
  if (dryRun) {
    // One page per lifetime, plus the media: the durable half gets an index of
    // its own beside the clips it renders, so a dry run has to count two when
    // there are demos or it will disagree with the publish it is previewing.
    const pages = demos.length > 0 ? 2 : 1;
    out(
      `ui-proof: would publish ${entries.length + pages} object(s) for pull request #${pullRequest}\n`,
    );
    out(`  ${reviewPrefix}/index.html  (text/html; charset=utf-8)\n`);
    if (demos.length > 0) {
      out(`  ${demoPrefix}/index.html  (text/html; charset=utf-8)\n`);
    }
    for (const e of entries) {
      out(`  ${keyFor(e)}  (${e.type}, ${e.size} bytes)\n`);
    }
    for (const c of comparisons) {
      if (!c.before) out(`ui-proof: "${c.surface}" has an after and no before\n`);
      if (!c.after) out(`ui-proof: "${c.surface}" has a before and no after\n`);
    }
    if (demos.length > 0) {
      out(demoWarning(demos));
    }
    out(`ui-proof: would link ${reviewPrefix}/index.html from the pull request body\n`);
    return 0;
  }

  // Everything the store needs is checked before the first network call. The
  // refusal is exit 1 rather than 2 — an operator who has not worked the runbook
  // yet is the ordinary state of a machine, not a broken script — and refusing
  // here rather than after the upload loop saves two round trips and a rendered
  // report nobody will see.
  const base = process.env.UI_PROOF_PUBLIC_BASE;
  const missing = [...missingConfig(), ...(base ? [] : ["UI_PROOF_PUBLIC_BASE"])];
  if (missing.length > 0) {
    err(
      `ui-proof: the artifact store is not configured — ${missing.join(", ")} unset. The bucket, its lifecycle rules and its credential are a human's step; see docs/runbooks/ui-proof-artifacts.md\n`,
    );
    return 1;
  }

  if (demos.length > 0) {
    out(demoWarning(demos));
  }

  const view = JSON.parse(await gh(["pr", "view", pullRequest, "--json", "title,body,url"]));
  const repo = JSON.parse(await gh(["repo", "view", "--json", "nameWithOwner"])).nameWithOwner;
  // `-F` rather than `-f`: only the typed form reads `@-` from stdin, and `-f`
  // sends the literal string "@-" instead — which GitHub renders as the two
  // characters, so the report comes back with an empty body and no error anywhere.
  // Found by rendering a real pull request and counting the bytes.
  const bodyHtml = await gh(
    [
      "api",
      "--method",
      "POST",
      "/markdown",
      "-f",
      "mode=gfm",
      "-f",
      `context=${repo}`,
      "-F",
      "text=@-",
    ],
    view.body ?? "",
  );

  const origin = base.replace(/\/$/, "");
  const urlFor = (e) => `${origin}/${keyFor(e)}`;

  // **Two pages, because there are two lifetimes.** The review report renders the
  // comparisons and lives under the prefix the lifecycle rule empties. The demo
  // report renders only the durable clips and lives beside them, so the half that
  // is kept has a viewer that is kept — before this, the only page that rendered a
  // demo sat under the prefix that deletes.
  const uploads = [
    {
      key: `${reviewPrefix}/index.html`,
      body: renderReport({ title: view.title, bodyHtml, comparisons, demos, urlFor }),
      type: "text/html; charset=utf-8",
    },
    ...entries.map((e) => ({
      key: keyFor(e),
      path: join(dir, e.file),
      type: e.type,
      length: e.size,
    })),
  ];

  const demoUrl = demos.length > 0 ? `${origin}/${demoPrefix}/index.html` : undefined;
  if (demoUrl) {
    uploads.push({
      key: `${demoPrefix}/index.html`,
      body: renderReport({
        title: `${view.title} — the story, kept`,
        bodyHtml,
        comparisons: [],
        demos,
        urlFor,
      }),
      type: "text/html; charset=utf-8",
    });
  }

  const { putObject } = await import("./ui-proof-store.mjs");
  for (const u of uploads) {
    // Sequential on purpose, against the rule's advice. `Promise.all` here would
    // open every read stream at once — a handful of videos held in flight
    // together — to save wall-clock on an upload nobody is waiting on, and it
    // would interleave the progress lines so a failure names no file.
    // oxlint-disable-next-line no-await-in-loop
    await putObject({
      key: u.key,
      type: u.type,
      body: u.path ? createReadStream(u.path) : u.body,
      length: u.length ?? Buffer.byteLength(u.body),
    });
    out(`  uploaded ${u.key}\n`);
  }

  const url = `${origin}/${reviewPrefix}/index.html`;
  const surfaces = [...new Set(entries.map((e) => e.surface))].toSorted();
  const demoSurfaces = [...new Set(demos.map((e) => e.surface))].toSorted();
  const next = withBlock(view.body ?? "", linkBlock({ url, surfaces, demoUrl, demoSurfaces }));
  await gh(["pr", "edit", pullRequest, "--body-file", "-"], next);

  out(`ui-proof: published and linked ${url}\n`);
  return 0;
}

/**
 * A demo has no expiry, so publishing one is the irreversible half of this
 * pipeline. The lifetime is decided by whether the ticket has a spec parent, and
 * this script reads only a filename — it cannot check the ticket graph, so it
 * says so loudly instead of deciding quietly. Naming the files is the point: a
 * `demo-` capture on a triage ticket is the mistake, and it is invisible in a
 * list of five uploads.
 */
const demoWarning = (demos) =>
  `ui-proof: ${demos.length} durable clip(s) — ${demos.map((d) => d.file).join(", ")}. These never expire. Publish them only for a ticket with a spec parent; see ui-evidence-retention in docs/policy/build.md\n`;

/** 16 hex characters of real randomness: enough that the prefix is not walkable. */
function randomNonce() {
  return [...crypto.getRandomValues(new Uint8Array(8))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Importable for the fixture suite without publishing anything.
if (process.argv[1] && import.meta.url.endsWith(basename(process.argv[1]))) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((e) => {
      err(`ui-proof: ${e?.stack ?? e}\n`);
      process.exit(2);
    });
}
