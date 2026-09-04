#!/usr/bin/env node
// What every route costs a visitor before the page is interactive, read out of
// a production build rather than recalled.
//
// **Why a script and not a number in a document.** The figure this repository
// carried for months — 297 / 390 / 403 KB — was about 39 KB high on every route,
// because it counted the `noModule` polyfill bundle, which no browser inside the
// supported floor downloads. Nobody noticed for two efforts, and the reason
// nobody noticed is that re-taking the measurement meant remembering a method:
// which files count, which are excluded, and at what compression. A number
// nobody can cheaply re-take is a number that goes wrong quietly, so the method
// is the artefact and the number is its output.
//
// **The method, stated once here and encoded below.** Every `<script src>` the
// prerendered document requests, the `noModule` bundle excluded, each chunk
// compressed on its own and summed. That is what a browser inside the floor
// actually fetches to make the page interactive: async or not, those tags are
// requested on the first load, and a `<script>` the document does not name is
// not part of this number however large it is. The excluded bundle is printed
// in its own column rather than dropped silently — the mistake it caused is
// cheaper to keep visible than to write down somewhere.
//
// Two exit codes, which is one fewer than this directory's other scripts have:
//
//   0  the table is on stdout
//   2  could not reach an answer at all
//
// There is deliberately no `1`. This reports and blocks nothing: the budget it
// is measured against is an amendable requirement in a spec, not a rule a script
// gets to enforce, and a build artefact is not something the pull-request checks
// have. `2` on a run that could not measure, for the reason its neighbours give:
// a measurement that cannot run must never be readable as one that found the
// page small.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";

// Anything that stops the script reaching an answer, as against an answer of
// "this route is large".
class MeasurementError extends Error {}

const DEFAULT_APP = "apps/web";

// Compress each chunk the way a CDN serving static assets does: once, ahead of
// time, at the top setting. Anything lower measures this machine's patience
// rather than the visitor's connection.
const GZIP = { level: 9 };
const BROTLI = { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } };

function parseArgs(argv) {
  const options = { app: resolve(process.cwd(), DEFAULT_APP), routes: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === "--app") {
      const value = argv[i + 1];
      if (value === undefined) throw new MeasurementError("--app needs a value");
      options.app = resolve(value);
      i += 1;
      continue;
    }
    if (flag.startsWith("-")) throw new MeasurementError(`unknown argument: ${flag}`);
    options.routes.push(flag);
  }
  return options;
}

/**
 * The prerendered documents, as `route -> file`.
 *
 * `index.html` is `/` and every other path is its own route, so the list comes
 * from the build rather than from a hard-coded set that silently stops covering
 * a route somebody adds. The two framework documents whose names begin with `_`
 * are kept: `_not-found` is a page a visitor really can land on, and a 404 that
 * ships 300 KB is worth seeing.
 */
function documents(app) {
  const root = join(app, ".next", "server", "app");
  let entries;
  try {
    entries = walk(root);
  } catch {
    throw new MeasurementError(
      `no prerendered documents under ${readable(root)} — run a production build first`,
    );
  }
  if (entries.length === 0) {
    throw new MeasurementError(
      `no prerendered documents under ${readable(root)} — run a production build first`,
    );
  }

  const found = new Map();
  for (const path of entries) {
    const slug = relative(root, path).replace(/\.html$/, "");
    found.set(slug === "index" ? "/" : `/${slug}`, path);
  }
  return found;
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return walk(path);
    return entry.name.endsWith(".html") ? [path] : [];
  });
}

const SCRIPT_TAG = /<script\b[^>]*\bsrc=(?:"([^"]*)"|'([^']*)')[^>]*>/gi;

/**
 * Every script the document asks for, in order, deduplicated by URL and each
 * carrying whether the browser will skip it.
 *
 * **`noModule` is read off the tag, not guessed from the filename.** It is the
 * attribute that decides whether a browser fetches the file at all — a module-
 * supporting engine ignores the tag entirely — and the filename says nothing.
 */
function scriptsIn(html) {
  const seen = new Set();
  const scripts = [];
  for (const match of html.matchAll(SCRIPT_TAG)) {
    const [tag, doubleQuoted, singleQuoted] = match;
    const src = doubleQuoted ?? singleQuoted;
    if (!src || seen.has(src)) continue;
    seen.add(src);
    scripts.push({ src, legacy: /\bnomodule\b/i.test(tag) });
  }
  return scripts;
}

const ASSET_PREFIX = "/_next/";

function chunkPath(app, src) {
  if (!src.startsWith(ASSET_PREFIX)) {
    // A script served from somewhere else is a script this cannot weigh, and
    // reporting the page without it would understate it by exactly that script.
    throw new MeasurementError(`a script is not served from the build output: ${src}`);
  }
  return join(app, ".next", src.slice(ASSET_PREFIX.length));
}

/**
 * The weight of one document, or `null` where there is no document to weigh.
 *
 * **A route rendered on demand has an empty `.html` beside the prerendered
 * ones**, and summing its zero scripts to `0 KB` is the exact failure this
 * script exists to prevent: a route that ships the whole framework, reported as
 * the lightest page in the build. `/admin` is `instant = false` and is one, so
 * this is a real shape in this repository rather than a hypothetical.
 */
function weigh(app, html) {
  const scripts = scriptsIn(html);
  if (scripts.length === 0) return null;

  const totals = { gzip: 0, brotli: 0, legacyGzip: 0, count: 0 };
  for (const { src, legacy } of scripts) {
    const path = chunkPath(app, src);
    let bytes;
    try {
      bytes = readFileSync(path);
    } catch {
      throw new MeasurementError(
        `the document asks for a chunk the build does not contain: ${src}`,
      );
    }
    const gzip = gzipSync(bytes, GZIP).length;
    if (legacy) {
      totals.legacyGzip += gzip;
      continue;
    }
    totals.count += 1;
    totals.gzip += gzip;
    totals.brotli += brotliCompressSync(bytes, BROTLI).length;
  }
  return totals;
}

const kb = (bytes) => `${Math.round(bytes / 1024)} KB`;

// Relative where that is shorter to read, absolute where it would be a run of
// `..` segments — a path a person cannot follow is a worse message than a long
// one.
function readable(path) {
  const short = relative(process.cwd(), path);
  return short === "" || short.startsWith("..") ? path : short;
}

function table(rows, onDemand) {
  const lines = [
    "First-load JavaScript, per route. Every `<script src>` the prerendered",
    "document requests, each chunk compressed on its own and summed. gzip is at",
    "level 9 and brotli at quality 11 — the settings a CDN compresses a static",
    "asset with once, ahead of time.",
    "",
    "The last column is what the `noModule` bundle would add. It is excluded",
    "from the figures because no browser inside the supported floor fetches it,",
    "and it is printed because counting it once put every number on record about",
    "39 KB high.",
    "",
    "| Route | scripts | gzip | brotli | `noModule`, excluded |",
    "| --- | --- | --- | --- | --- |",
  ];
  for (const [route, totals] of rows) {
    lines.push(
      `| \`${route}\` | ${totals.count} | **${kb(totals.gzip)}** | ${kb(totals.brotli)} | +${kb(totals.legacyGzip)} |`,
    );
  }

  // Said out loud rather than left as an absent row, because a route missing
  // from a table reads as a route that was fine.
  if (onDemand.length > 0) {
    lines.push(
      "",
      `Rendered on demand, so there is no prerendered document to weigh: ${onDemand
        .map((route) => `\`${route}\``)
        .join(", ")}.`,
    );
  }
  return lines.join("\n");
}

function main() {
  const { app, routes } = parseArgs(process.argv.slice(2));
  if (!statSync(join(app, ".next"), { throwIfNoEntry: false })?.isDirectory()) {
    throw new MeasurementError(
      `no build output at ${readable(join(app, ".next"))} — run a production build first`,
    );
  }

  const found = documents(app);
  const wanted = routes.length > 0 ? routes : [...found.keys()].toSorted();

  const named = routes.length > 0;
  const rows = [];
  const onDemand = [];

  for (const route of wanted) {
    const document = found.get(route);
    const totals = document === undefined ? null : weigh(app, readFileSync(document, "utf8"));
    if (totals === null) {
      // **Asked for by name, it refuses; swept up by the default run, it is
      // named under the table.** Somebody who types a route came to check that
      // route, and answering with a table that silently does not contain it is
      // the shape of wrong answer this script exists to stop.
      if (named) {
        throw new MeasurementError(
          `no prerendered document for ${route} — the build renders it on demand, so it has no first load to measure`,
        );
      }
      onDemand.push(route);
      continue;
    }
    rows.push([route, totals]);
  }

  process.stdout.write(`${table(rows, onDemand)}\n`);
}

try {
  main();
} catch (error) {
  process.stdout.write(`First-load measurement could not run: ${error.message}\n`);
  process.exit(2);
}
