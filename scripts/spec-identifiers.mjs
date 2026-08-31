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
// **Two tokenisers, because shell is a second language rather than a widened
// first one.** A `.sh` file's quoting rules are not JavaScript's: `'…'` takes no
// escapes, `$'…'` is a third quoting form, a `#` opens a comment only at a word
// boundary, and a heredoc body is data at a delimiter the script names. Reading
// shell with the JavaScript reader would have found citations in some files and
// silently mis-read others, which is the failure mode this whole gate exists to
// avoid.
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

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs", ".sh"];

// `.agents` and `.claude` hold vendored skills, which ship real JavaScript that
// is not ours to edit — the root `.oxlintrc.json` skips them for the same
// reason, and `//#spec-identifiers` negates them out of its `inputs` so the two
// statements of this set agree. The rest are build output and dependencies.
//
// Since this gate learned to read shell, `.claude` carries a second reason:
// `.claude/hooks/gate-test.sh` is the suite that drives this gate, and its
// fixtures are the very citations it refuses, so it cannot be subject to itself.
// The hooks beside it can be, and that suite runs this gate over them.
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

/**
 * Every string literal in a shell script, with the line and column it starts at.
 *
 * Three quoting forms, all of them read: `'…'` takes no escapes at all and may
 * span lines, `"…"` takes `\` escapes and interpolates, and `$'…'` is a third
 * form with escapes of its own.
 *
 * A double-quoted body is split around `$name`, `${…}`, `$(…)` and a backtick,
 * exactly as the JavaScript reader splits a template around `${…}`: a
 * substitution names a variable rather than saying anything, so `"$NFR8 holds"`
 * carries no citation — while a command substitution is a nested script, so its
 * own strings are read as strings.
 *
 * **A `#` opens a comment only at a word boundary**, which is the rule that
 * makes `$#`, `${#items[@]}` and `foo#bar` ordinary text; a `#` inside either
 * quote is never one. Comments are the record and are never read, and the cost
 * of getting that wrong is not a missed line but a swallowed file: an apostrophe
 * in a comment read as an opening quote runs to the next one, wherever that is.
 *
 * **A heredoc body is data**, so it is skipped whole — `<<`, `<<-`, a quoted or
 * bare delimiter, and the terminator matched with leading tabs stripped for the
 * dash form. The marker's quoting decides whether the body expands, which
 * changes nothing here, so it is dropped the way `gate-lib.sh` drops it for the
 * neighbouring problem. `<<<` is a here-string and is not a heredoc: what
 * follows it is an ordinary word, and a quoted one is an ordinary string.
 */
export function shellStringLiterals(source) {
  const literals = [];
  // The base script, a `$( … )` or backtick substitution, and a double-quoted
  // span. A stack, because each of them nests inside the others. `parens` is
  // tracked only inside a substitution, where a `)` at depth zero ends it — at
  // the top level a `)` is a `case` pattern or a function definition and closes
  // nothing.
  const stack = [{ kind: "code", parens: 0 }];
  // Heredocs are announced on one line and read from the next, and a line may
  // announce more than one.
  const pending = [];
  let line = 1;
  let lineStart = 0;
  let i = 0;
  let wordBoundary = true;

  const at = (index) => ({ line, column: index - lineStart + 1 });
  const newline = (index) => {
    line += 1;
    lineStart = index + 1;
  };
  const emit = (position, start, end) => {
    const text = source.slice(start, end);
    if (text.length > 0) literals.push({ ...position, text });
  };

  // Past a `${ … }`, reading the **word** most of its forms carry. This is not
  // a script, so it is not recursed into — but it is not only a name either:
  // `${MSG:-a default}`, `${VAR#prefix}` and `${VAR//a/b}` all put text on
  // screen, and `plan-to-design-gate.sh` writes one into the middle of a refusal
  // a person reads. Skipping the expansion whole, which this reader did first,
  // lost every one of them. So the name and its subscript are stepped over and
  // whatever follows is read as a literal — operator characters included, since
  // no citation is shaped like one.
  //
  // `${#items[@]}` and `${!ref}` open with an operator instead of a name, and
  // what follows *is* the name, so those two carry no word at all.
  const readBraceExpansion = (index) => {
    let j = index + 1;
    const prefixed = source[j] === "#" || source[j] === "!";
    if (prefixed) j += 1;
    if (/[A-Za-z_]/.test(source[j] ?? "")) {
      while (j < source.length && /\w/.test(source[j])) j += 1;
    } else if (/\d/.test(source[j] ?? "")) {
      while (j < source.length && /\d/.test(source[j])) j += 1;
    } else if (j < source.length && source[j] !== "}") {
      // One of the special parameters — `@`, `*`, `?`, `$`, `!`, `-`, `#`.
      j += 1;
    }
    if (source[j] === "[") {
      while (j < source.length && source[j] !== "]") j += 1;
      j += 1;
    }

    const wordStart = j;
    const position = at(wordStart);
    let depth = 1;
    while (j < source.length && depth > 0) {
      const c = source[j];
      if (c === "\\") {
        j += 2;
        continue;
      }
      if (c === "\n") newline(j);
      if (c === "{") depth += 1;
      else if (c === "}") {
        depth -= 1;
        if (depth === 0) break;
      }
      j += 1;
    }
    if (!prefixed) emit(position, wordStart, Math.min(j, source.length));
    return j < source.length ? j + 1 : j;
  };

  // Past a `$(( … ))` or a `(( … ))`. Arithmetic holds no string, and — the
  // reason this exists — its `<<` is a shift rather than a heredoc marker.
  // `n=$(( 1 << 2 ))` announced a heredoc terminated by `2` and swallowed every
  // line after it.
  const skipArithmetic = (index) => {
    let depth = 0;
    let j = index;
    while (j < source.length) {
      const c = source[j];
      if (c === "\n") newline(j);
      if (c === "(") depth += 1;
      else if (c === ")") {
        depth -= 1;
        if (depth === 0) return j + 1;
      }
      j += 1;
    }
    return j;
  };

  // A `'…'` and a `$'…'` differ in one thing: the first takes no escapes at
  // all, which is why an apostrophe cannot be escaped out of it.
  const readSingleQuoted = (start, escapes) => {
    const position = at(start);
    let j = start;
    while (j < source.length && source[j] !== "'") {
      if (source[j] === "\n") newline(j);
      j += escapes && source[j] === "\\" ? 2 : 1;
    }
    emit(position, start, Math.min(j, source.length));
    return source[j] === "'" ? j + 1 : j;
  };

  // Past the bodies of every heredoc the line just read announced. An
  // unterminated one means the rest of the file is its body, which is what a
  // shell would do with it too.
  const skipHeredocBodies = (index) => {
    let j = index;
    while (pending.length > 0) {
      const { term, stripTabs } = pending.shift();
      let closed = false;
      while (j < source.length && !closed) {
        let end = source.indexOf("\n", j);
        if (end === -1) end = source.length;
        let text = source.slice(j, end);
        if (stripTabs) text = text.replace(/^\t+/, "");
        if (end < source.length) newline(end);
        j = end < source.length ? end + 1 : end;
        if (text === term) closed = true;
      }
      if (!closed) return j;
    }
    return j;
  };

  while (i < source.length) {
    const top = stack.at(-1);
    const character = source[i];

    if (top.kind === "dquote") {
      // One literal chunk, up to the closing quote or the expansion that
      // interrupts it.
      const start = i;
      const position = at(start);
      while (i < source.length) {
        const c = source[i];
        if (c === "\\") {
          if (source[i + 1] === "\n") newline(i + 1);
          i += 2;
          continue;
        }
        if (c === '"' || c === "`") break;
        if (c === "$" && (source[i + 1] === "(" || source[i + 1] === "{")) break;
        if (c === "$" && /[A-Za-z_]/.test(source[i + 1] ?? "")) break;
        if (c === "\n") newline(i);
        i += 1;
      }
      emit(position, start, i);
      const c = source[i];
      if (c === '"') {
        stack.pop();
        i += 1;
      } else if (c === "`") {
        stack.push({ kind: "backtick", parens: 0 });
        i += 1;
      } else if (c === "$" && source[i + 1] === "(" && source[i + 2] === "(") {
        i = skipArithmetic(i + 1);
      } else if (c === "$" && source[i + 1] === "(") {
        stack.push({ kind: "substitution", parens: 0 });
        i += 2;
      } else if (c === "$" && source[i + 1] === "{") {
        i = readBraceExpansion(i + 1);
      } else if (c === "$") {
        i += 1;
        while (i < source.length && /\w/.test(source[i])) i += 1;
      }
      continue;
    }

    if (character === "\n") {
      newline(i);
      i += 1;
      wordBoundary = true;
      if (pending.length > 0) i = skipHeredocBodies(i);
      continue;
    }

    if (character === "\\") {
      if (source[i + 1] === "\n") newline(i + 1);
      i += 2;
      wordBoundary = false;
      continue;
    }

    if (character === "#" && wordBoundary) {
      while (i < source.length && source[i] !== "\n") i += 1;
      continue;
    }

    if (character === "'") {
      i = readSingleQuoted(i + 1, false);
      wordBoundary = false;
      continue;
    }

    if (character === '"') {
      stack.push({ kind: "dquote", parens: 0 });
      i += 1;
      continue;
    }

    if (character === "`") {
      if (top.kind === "backtick") stack.pop();
      else stack.push({ kind: "backtick", parens: 0 });
      i += 1;
      wordBoundary = false;
      continue;
    }

    if (character === "$") {
      const next = source[i + 1];
      if (next === "'") {
        i = readSingleQuoted(i + 2, true);
      } else if (next === '"') {
        stack.push({ kind: "dquote", parens: 0 });
        i += 2;
      } else if (next === "(" && source[i + 2] === "(") {
        i = skipArithmetic(i + 1);
      } else if (next === "(") {
        stack.push({ kind: "substitution", parens: 0 });
        i += 2;
      } else if (next === "{") {
        i = readBraceExpansion(i + 1);
      } else {
        i += 1;
        while (i < source.length && /\w/.test(source[i])) i += 1;
      }
      wordBoundary = false;
      continue;
    }

    if (character === "(" && source[i + 1] === "(" && wordBoundary) {
      i = skipArithmetic(i);
      wordBoundary = true;
      continue;
    }

    if (character === "<" && source[i + 1] === "<") {
      // `<<<` is a here-string, and `<<=` an arithmetic assignment. Neither
      // announces a body.
      if (source[i + 2] === "<" || source[i + 2] === "=") {
        i += 3;
        wordBoundary = true;
        continue;
      }
      let j = i + 2;
      const stripTabs = source[j] === "-";
      if (stripTabs) j += 1;
      while (source[j] === " " || source[j] === "\t") j += 1;
      const start = j;
      while (j < source.length && !/[\s;&|<>()]/.test(source[j])) j += 1;
      // Quote removal, and nothing else — which is exactly what a shell does
      // to the marker. Dropping every non-word character instead (as
      // `gate-lib.sh` does for its own, coarser purpose) turns `<<END-OF-MSG`
      // into `ENDOFMSG`, which no terminator line matches, so the body runs to
      // the end of the file and the file reports clean.
      const term = source.slice(start, j).replace(/['"\\]/g, "");
      if (term !== "") pending.push({ term, stripTabs });
      i = j;
      wordBoundary = true;
      continue;
    }

    if (top.kind === "substitution") {
      if (character === "(") top.parens += 1;
      else if (character === ")") {
        if (top.parens === 0) {
          stack.pop();
          i += 1;
          wordBoundary = true;
          continue;
        }
        top.parens -= 1;
      }
    }

    wordBoundary = /[\s;&|()<>]/.test(character);
    i += 1;
  }

  return literals;
}

// The extension picks the reader. There is no sniffing of content: a file named
// `.sh` is shell and everything else in the list is JavaScript, so a file cannot
// be read by the wrong one because of what its first line happens to say.
const literalsIn = (path, source) =>
  path.endsWith(".sh") ? shellStringLiterals(source) : stringLiterals(source);

function violations(root) {
  const found = [];
  for (const path of sourceFiles(root)) {
    let source;
    try {
      source = readFileSync(path, "utf8");
    } catch (error) {
      throw new GateError(`${path} cannot be read: ${error.message}`);
    }
    for (const literal of literalsIn(path, source)) {
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
