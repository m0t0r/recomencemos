#!/usr/bin/env node
// The blocking pass `REVIEW.md` calls "Spec identifiers stay in the source",
// made red rather than reviewed: a spec identifier — NFR14, ADR-0015, DD5, C43,
// story 7, #17 — may not appear in any string that leaves the source file.
//
// **Comments are the record and are never touched.** That is the whole reason
// this cannot be a grep: the citations this repository wants to keep and the
// ones it refuses sit on adjacent lines of the same file, and a line-prefix test
// cannot tell a continuation line of a block comment from a string. So the file
// is tokenised — comments, regular expressions and strings each recognised for
// what they are — and only the string literals are scanned.
//
// **Every string literal, not only the ones a reviewer would guess at.** The
// rule is about where a string is read, and this gate cannot know which of them
// reach a terminal, a log drain or a browser. Scanning all of them is the
// reading that needs no judgement, and an identifier in a string that never
// leaves is a citation that belongs in the comment above it anyway.
//
// **Three exit codes, because two of them are different answers.** `0` is a
// pass, `1` is at least one identifier in a string, and `2` is the gate failing
// to run at all — an unreadable tree, a directory that is not one. The third
// exists so that a broken gate cannot be mistaken for a clean one.
//
// Output goes through `process.stdout.write` rather than `console.log`, for the
// reason `CLAUDE.md` gives: the console is not an output channel here, and this
// runs before, and outside, the application that has a logger.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"];

// `.agents` and `.claude` hold vendored skills, which ship real JavaScript that
// is not ours to edit — the root `.oxlintrc.json` skips them for the same
// reason, and `//#spec-identifiers` negates them out of its `inputs` so the two
// statements of this set agree. The rest are build output and dependencies.
const SKIPPED_DIRECTORIES = new Set([
  ".agents",
  ".claude",
  ".git",
  ".next",
  ".turbo",
  "coverage",
  "dist",
  "node_modules",
  "out",
]);

// Written as regular expressions rather than as strings so that this file is
// subject to its own gate: a pattern moved into a string literal here would be
// reported by the next run.
const IDENTIFIER_PATTERNS = [
  /\bNFR-?\d+\b/,
  /\bADR[-\s]\d{3,4}\b/,
  /\bDD-?\d+\b/,
  /\bC\d{1,3}\b/,
  /\bstor(?:y|ies)\s+\d+/i,
  /\b(?:spec|effort)\s+\d{4}\b/i,
  /§\s?\d+/,
  // An issue or pull-request reference. `&#8203;` is an HTML entity and
  // `#lib/auth` is a subpath import, so what precedes the `#` decides.
  /(?<![\w#&])#\d+\b/,
];

// A CSS colour is the one thing shaped like an issue reference that is not one,
// and it is told apart by being the whole string rather than a word inside a
// sentence: `#000000` is a colour, `see #17` is a citation. The lengths are the
// four CSS accepts, so `"#94"` is still read as a number.
const CSS_COLOUR = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

const out = (line = "") => process.stdout.write(`${line}\n`);
const countStrings = (n) => `${n} ${n === 1 ? "string carries" : "strings carry"}`;

// Anything that stops the gate reaching an answer, as against an answer of "no".
class GateError extends Error {}

function parseArgs(argv) {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const options = { root: repoRoot };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag !== "--root") throw new GateError(`unknown argument: ${flag}`);
    const value = argv[i + 1];
    if (value === undefined) throw new GateError(`${flag} needs a value`);
    options.root = resolve(value);
    i += 1;
  }
  return options;
}

function sourceFiles(root) {
  let stats;
  try {
    stats = statSync(root);
  } catch (error) {
    throw new GateError(`${root} cannot be read: ${error.message}`);
  }
  if (!stats.isDirectory()) throw new GateError(`${root} is not a directory`);

  const found = [];
  const walk = (directory) => {
    let entries;
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch (error) {
      throw new GateError(`${directory} cannot be read: ${error.message}`);
    }
    for (const entry of entries.toSorted((a, b) => a.name.localeCompare(b.name))) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRECTORIES.has(entry.name)) walk(path);
      } else if (entry.isFile() && SOURCE_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
        found.push(path);
      }
    }
  };
  walk(root);
  return found;
}

/**
 * The token before a `/` decides whether it opens a regular expression or
 * divides. The set below is deliberately the *operator* half rather than the
 * complement of it: an unrecognised context reads as division, which is the
 * cheaper mistake — the `/` becomes one ordinary character instead of the start
 * of a span.
 *
 * **Cheaper, not free, and the two entries below are what that cost bought.**
 * Reading a real regular expression as division tokenises its body as code, and
 * a body holding `//`, `/*` or a backtick then opens a comment or a template
 * that runs past every string after it. `/[/*]/` inside an arrow function
 * blinded this gate for a whole file until `=>` was added here.
 *
 * `<` and a bare `>` are absent on purpose, and it is the case that matters in a
 * `.tsx` file: every closing JSX tag is `<` then `/`, and every opening one ends
 * in `>` with JSX text after it. `=>` is safe because no JSX `>` is preceded by
 * an `=` — an attribute's value is quoted or braced.
 *
 * `""` is the start of the input, where nothing precedes the `/` at all.
 */
const REGEX_MAY_FOLLOW = new Set([..."(,=:[!&|?{};+-*%~^", "=>", ""]);
const REGEX_MAY_FOLLOW_KEYWORDS = new Set([
  "await",
  "case",
  "delete",
  "do",
  "else",
  "in",
  "instanceof",
  "new",
  "of",
  "return",
  "typeof",
  "void",
  "yield",
]);

/**
 * Every string literal in a JavaScript, TypeScript or JSX source, with the line
 * and column it starts at. A template literal contributes one entry per literal
 * chunk, so `` `a ${x} b` `` reports `a ` and ` b` at their own positions and
 * the expression between them is read as code.
 *
 * A single- or double-quoted run that reaches a line break is not a string in
 * any valid source, so it is a sign the scanner mis-read something — most
 * likely an apostrophe in JSX text. It is reported anyway, and bounded to that
 * one line: a gate that discarded what it could not parse would be a gate that
 * fails open on the one input nobody predicted.
 */
export function stringLiterals(source) {
  const literals = [];
  // A stack rather than a flag, because `${}` puts code back inside a template
  // and templates nest. `braces` counts the ones that belong to that code span,
  // so the `}` closing the substitution is told apart from the ones inside it.
  const stack = [{ kind: "code", braces: 0 }];
  let line = 1;
  let lineStart = 0;
  let previous = ""; // the last token that was neither whitespace nor comment
  let previousWord = "";

  const at = (index) => ({ line, column: index - lineStart + 1 });
  // The position is passed in rather than derived here: a template chunk can
  // span lines, so by the time it ends the counters name its last line.
  const emit = (position, start, end) => {
    const text = source.slice(start, end);
    if (text.length > 0) literals.push({ ...position, text });
  };

  let i = 0;
  while (i < source.length) {
    const character = source[i];
    const top = stack.at(-1);

    if (character === "\n") {
      line += 1;
      lineStart = i + 1;
      i += 1;
      continue;
    }

    if (top.kind === "template") {
      // Inside a template: gather one literal chunk, up to the closing backtick
      // or the `${` that interrupts it.
      const start = i;
      const position = at(start);
      while (i < source.length) {
        if (source[i] === "\\") {
          i += 2;
          continue;
        }
        if (source[i] === "`" || (source[i] === "$" && source[i + 1] === "{")) break;
        if (source[i] === "\n") {
          line += 1;
          lineStart = i + 1;
        }
        i += 1;
      }
      emit(position, start, i);
      previousWord = "";
      if (source[i] === "`") {
        stack.pop();
        previous = "`";
        i += 1;
      } else if (source[i] === "$") {
        stack.push({ kind: "code", braces: 0 });
        previous = "{";
        i += 2;
      }
      continue;
    }

    if (/\s/.test(character)) {
      i += 1;
      continue;
    }

    if (character === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") i += 1;
      continue;
    }

    if (character === "/" && source[i + 1] === "*") {
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) {
        if (source[i] === "\n") {
          line += 1;
          lineStart = i + 1;
        }
        i += 1;
      }
      i += 2;
      // A comment is not a token: `x /* c */ / 2` still divides, and
      // `return /* c */ /re/` still opens a regular expression.
      continue;
    }

    if (character === "'" || character === '"') {
      const start = i + 1;
      const position = at(start);
      i += 1;
      while (i < source.length && source[i] !== character && source[i] !== "\n") {
        i += source[i] === "\\" ? 2 : 1;
      }
      emit(position, start, Math.min(i, source.length));
      if (source[i] === character) i += 1;
      previous = character;
      previousWord = "";
      continue;
    }

    if (character === "`") {
      stack.push({ kind: "template" });
      previousWord = "";
      i += 1;
      continue;
    }

    if (
      character === "/" &&
      (REGEX_MAY_FOLLOW.has(previous) || REGEX_MAY_FOLLOW_KEYWORDS.has(previousWord))
    ) {
      // Scan the body, remembering where it started: an unterminated one means
      // this was a division after all, and the `/` is put back.
      const start = i;
      let j = i + 1;
      let inClass = false;
      let closed = false;
      while (j < source.length && source[j] !== "\n") {
        const c = source[j];
        if (c === "\\") {
          j += 2;
          continue;
        }
        if (c === "[") inClass = true;
        else if (c === "]") inClass = false;
        else if (c === "/" && !inClass) {
          closed = true;
          break;
        }
        j += 1;
      }
      if (closed) {
        i = j + 1;
        previous = "/";
        previousWord = "";
        continue;
      }
      i = start + 1;
      previous = "/";
      previousWord = "";
      continue;
    }

    if (character === "{") top.braces += 1;
    if (character === "}") {
      if (top.braces === 0 && stack.length > 1) {
        stack.pop();
        previous = "}";
        previousWord = "";
        i += 1;
        continue;
      }
      top.braces -= 1;
    }

    if (/[A-Za-z_$]/.test(character)) {
      const start = i;
      while (i < source.length && /[\w$]/.test(source[i])) i += 1;
      previousWord = source.slice(start, i);
      previous = source[i - 1];
      continue;
    }

    // `=>` is the one operator read as two characters, because it is the one
    // whose second character means something different on its own: a bare `>`
    // closes a JSX tag, and an arrow opens a function body.
    previous = character === ">" && source[i - 1] === "=" ? "=>" : character;
    previousWord = "";
    i += 1;
  }

  return literals;
}

function violations(root) {
  const found = [];
  for (const path of sourceFiles(root)) {
    let source;
    try {
      source = readFileSync(path, "utf8");
    } catch (error) {
      throw new GateError(`${path} cannot be read: ${error.message}`);
    }
    for (const literal of stringLiterals(source)) {
      if (CSS_COLOUR.test(literal.text.trim())) continue;
      for (const pattern of IDENTIFIER_PATTERNS) {
        const match = pattern.exec(literal.text);
        if (match) {
          found.push({ file: relative(root, path), ...literal, match: match[0] });
          break;
        }
      }
    }
  }
  return found;
}

function main() {
  const { root } = parseArgs(process.argv.slice(2));
  const found = violations(root);

  for (const v of found) {
    out(`BLOCKING  ${v.file}:${v.line}:${v.column}  ${v.match}`);
    out(`          ${v.text.trim()}`);
  }

  if (found.length > 0) {
    out();
    out(
      `Spec-identifier check failed: ${countStrings(found.length)} a citation a reader outside this repository cannot resolve.`,
    );
    out("Say the substance instead, and move the citation to the comment above the string.");
    process.exit(1);
  }
  out("Spec-identifier check passed: 0 citations in a string.");
}

// Importable for its scanner without running the gate, which is what lets the
// tokeniser be exercised directly.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    out(`Spec-identifier check could not run: ${error.message}`);
    process.exit(2);
  }
}
