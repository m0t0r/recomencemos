# The spec-identifier gate is the third non-hook here, for the reason the other
# two are: repo logic deciding whether work may proceed. `REVIEW.md` carries the
# rule -- a spec identifier may not appear in any string that leaves the source
# file, and comments are the record and are never touched.
#
# The run against *this* repository is deliberately not here, exactly as it is
# not for migration integrity: this suite is cached on `.claude/hooks/**` plus
# the scripts, and this gate's answer also depends on every source file in the
# repo, so a cached replay would report a pass nothing had checked. It runs as
# the `//#spec-identifiers` task, inside the same `pnpm test`.
IDENT="$REPO/scripts/spec-identifiers.mjs"

# One tree per case, so no case can pass because of a file another case wrote.
ident_dir() { local d="$ROOT/ident/$1"; mkdir -p "$d"; echo "$d"; }

# Most cases are one line of source, and reading them as one line is the point:
# the difference between a pass and a refusal is visible without opening a file.
ident_one() { # name filename content -> prints the tree
  local d; d=$(ident_dir "$1"); printf '%s\n' "$3" > "$d/$2"; echo "$d"
}

run_ident() { # name expect-exit expect-grep root [extra arguments]
  local name="$1" expect="$2" want="$3" dir="$4"
  shift 4
  expect_run "$name" "$expect" "$want" -- node "$IDENT" --root "$dir" "$@"
}

CLEAN="^Spec-identifier check passed"

section "Spec identifiers: the citations a string may not carry"
run_ident "a requirement number"  1 "^BLOCKING .*NFR8"     "$(ident_one nfr     a.ts 'const m = "the floor is NFR8";')"
run_ident "a decision record"     1 "^BLOCKING .*ADR-0004" "$(ident_one adr     a.ts 'const m = "trimmed by ADR-0004";')"
run_ident "a deep dive"           1 "^BLOCKING .*DD2"      "$(ident_one dd      a.ts 'const m = "DD2 caps the pool";')"
run_ident "a flagged concern"     1 "^BLOCKING .*C43"      "$(ident_one concern a.ts 'const m = "locked out, which is C43";')"
run_ident "a user story"          1 "^BLOCKING .*story 7"  "$(ident_one story   a.ts 'const m = "story 7 asks for it";')"
run_ident "an effort number"      1 "^BLOCKING .*spec 0002" "$(ident_one effort a.ts 'const m = "named in spec 0002";')"
run_ident "a runbook section"     1 "^BLOCKING .*§6"       "$(ident_one section a.ts 'const m = "see the runbook §6";')"
run_ident "an issue reference"    1 "^BLOCKING .*#17"      "$(ident_one issue   a.ts 'const m = "introduced by #17";')"
run_ident "a string carrying none of them" 0 "$CLEAN"      "$(ident_one none    a.ts 'const m = "the level floor";')"

section "Spec identifiers: every place a string is written"
run_ident "a test name"           1 "^BLOCKING .*NFR8"     "$(ident_one testname a.test.ts 'describe("NFR8 — the level floor", () => {});')"
run_ident "an operator-facing message" 1 "^BLOCKING .*DD5" "$(ident_one message  a.ts 'throw new AppError({ message: "DD5 declares it" });')"
run_ident "a line written to stdout" 1 "^BLOCKING .*§6"    "$(ident_one stdout   a.ts 'process.stdout.write("print them; see runbook §6");')"
run_ident "a single-quoted string" 1 "^BLOCKING .*NFR8"    "$(ident_one single   a.ts "const m = 'the floor is NFR8';")"
run_ident "a template literal chunk" 1 "^BLOCKING .*NFR8"  "$(ident_one template a.ts 'const m = `${x} is NFR8 as written`;')"
run_ident "an identifier-shaped variable in a substitution" 0 "$CLEAN" "$(ident_one substitution a.ts 'const m = `${NFR8} holds`;')"

section "Spec identifiers: comments are the record and are never read"
D=$(ident_dir linecomment)
cat > "$D/a.ts" <<'EOF'
// The floor is NFR8, cited here rather than in the message below.
const m = "the level floor";
EOF
run_ident "a line comment"                    0 "$CLEAN" "$D"

D=$(ident_dir blockcomment)
cat > "$D/a.ts" <<'EOF'
/*
 * NFR8 sets the floor, and this continuation line is the false positive a
 * line-prefix test cannot tell from a string.
 */
const m = "the level floor";
EOF
run_ident "a continuation line of a block comment" 0 "$CLEAN" "$D"

D=$(ident_dir jsxcomment)
cat > "$D/a.tsx" <<'EOF'
export function Panel() {
  return (
    <div>
      {/* Two standing notices, which is story 11. */}
      <p>Hola</p>
    </div>
  );
}
EOF
run_ident "a JSX comment block"               0 "$CLEAN" "$D"

D=$(ident_dir doccomment)
cat > "$D/a.ts" <<'EOF'
/** Bounded by NFR16, and read beside the code that proves it. */
export const MAX = 1;
EOF
run_ident "a doc-comment"                     0 "$CLEAN" "$D"

D=$(ident_dir markdown)
mkdir -p "$D/docs"
printf '%s\n' '# NFR8 and the level floor' > "$D/docs/notes.md"
printf '%s\n' 'const m = "the level floor";' > "$D/a.ts"
run_ident "a markdown file beside the source" 0 "$CLEAN" "$D"

section "Spec identifiers: the ways it must not fail open"
D=$(ident_dir jsxtags)
cat > "$D/a.tsx" <<'EOF'
export function Panel() {
  return (
    <div>
      <p>Hola</p>
    </div>
  );
}
const m = "the floor is NFR8";
EOF
run_ident "a closing JSX tag does not swallow what follows" 1 "^BLOCKING .*NFR8" "$D"

D=$(ident_dir jsxapostrophe)
cat > "$D/a.tsx" <<'EOF'
export function Panel() {
  return <p>Don't stop reading here</p>;
}
const m = "the floor is NFR8";
EOF
run_ident "an apostrophe in JSX text does not hide the rest" 1 "^BLOCKING .*NFR8" "$D"

D=$(ident_dir regexquote)
cat > "$D/a.ts" <<'EOF'
const quoted = /["']/;
const m = "the floor is NFR8";
EOF
run_ident "a regular expression holding a quote"  1 "^BLOCKING .*NFR8" "$D"

D=$(ident_dir regexbody)
cat > "$D/a.ts" <<'EOF'
const cited = /\bNFR\d+\b/;
const m = "the level floor";
EOF
run_ident "a regular expression is not a string"  0 "$CLEAN" "$D"

D=$(ident_dir division)
cat > "$D/a.ts" <<'EOF'
const half = (a + b) / 2;
const rest = half / 4;
const m = "the floor is NFR8";
EOF
run_ident "division is not the start of a pattern" 1 "^BLOCKING .*NFR8" "$D"

# A pattern in an arrow-function body is the context this reader lost first, and
# these three are why losing it matters rather than being untidy: read as
# division, the body is tokenised as code, and a `/*`, a `//` or a backtick in it
# then runs past every string in the rest of the file. The middle one used to
# report a clean tree.
D=$(ident_dir arrowslash)
cat > "$D/a.ts" <<'EOF'
const f = (s) => /[//]/.test(s);
const m = "the floor is NFR8";
EOF
run_ident "a pattern holding // after an arrow"  1 "^BLOCKING .*NFR8" "$D"

D=$(ident_dir arrowcomment)
cat > "$D/a.ts" <<'EOF'
const f = (s) => /[/*]/.test(s);
const m = "the floor is NFR8";
EOF
run_ident "a pattern holding /* after an arrow"  1 "^BLOCKING .*NFR8" "$D"

D=$(ident_dir arrowtick)
cat > "$D/a.ts" <<'EOF'
const f = (s) => /`/.test(s);
const m = "the floor is NFR8";
EOF
run_ident "a pattern holding a backtick after an arrow" 1 "^BLOCKING .*NFR8" "$D"

D=$(ident_dir greaterthan)
cat > "$D/a.ts" <<'EOF'
const bigger = (a, b) => a > b / 2;
const m = "the level floor";
EOF
run_ident "a bare greater-than still divides"    0 "$CLEAN" "$D"

D=$(ident_dir jsxarrow)
cat > "$D/a.tsx" <<'EOF'
export function Panel({ items }) {
  return <ul>{items.map((i) => <li key={i}>{i}</li>)}</ul>;
}
const m = "the floor is NFR8";
EOF
run_ident "an arrow inside JSX does not lose the tags" 1 "^BLOCKING .*NFR8" "$D"

D=$(ident_dir extensions)
printf '%s\n' 'const m = "the floor is NFR8";' > "$D/a.tsx"
printf '%s\n' 'const m = "the floor is NFR8";' > "$D/b.mjs"
printf '%s\n' 'const m = "the floor is NFR8";' > "$D/c.cts"
run_ident "every source extension is read"    1 "c.cts:1:" "$D"

D=$(ident_dir nested)
mkdir -p "$D/packages/domain/src"
printf '%s\n' 'const m = "the floor is NFR8";' > "$D/packages/domain/src/a.ts"
run_ident "a workspace nested three deep"     1 "packages/domain/src/a.ts:1:" "$D"

D=$(ident_dir vendored)
mkdir -p "$D/.agents/skills/x" "$D/.claude/skills/x" "$D/node_modules/x"
printf '%s\n' 'const m = "the floor is NFR8";' > "$D/.agents/skills/x/a.mjs"
printf '%s\n' 'const m = "the floor is NFR8";' > "$D/.claude/skills/x/a.mjs"
printf '%s\n' 'const m = "the floor is NFR8";' > "$D/node_modules/x/a.mjs"
run_ident "vendored skills and dependencies"  0 "$CLEAN" "$D"

section "Spec identifiers: a colour is not an issue number"
run_ident "a six-digit hex colour"    0 "$CLEAN"          "$(ident_one colour6 a.ts 'const fg = "#000000";')"
run_ident "a three-digit hex colour"  0 "$CLEAN"          "$(ident_one colour3 a.ts 'const fg = "#000";')"
run_ident "a reference inside a sentence" 1 "^BLOCKING .*#17" "$(ident_one sentence a.ts 'const m = "the shape #17 introduced";')"
run_ident "a subpath import specifier" 0 "$CLEAN"         "$(ident_one subpath a.ts 'import { auth } from "#lib/auth";')"

# The shell half. A `.sh` file is read by a second tokeniser, because shell
# quoting is not JavaScript quoting: `'…'` takes no escapes, `"…"` interpolates,
# `$'…'` is a third form, a `#` opens a comment only at a word boundary, and a
# heredoc body is data rather than a message the script writes.

section "Spec identifiers: a shell script is read too"
run_ident "a single-quoted string"   1 "^BLOCKING .*NFR8" "$(ident_one shsingle a.sh "say 'the floor is NFR8'")"
run_ident "a double-quoted string"   1 "^BLOCKING .*NFR8" "$(ident_one shdouble a.sh 'say "the floor is NFR8"')"
run_ident "a shell script carrying none of them" 0 "$CLEAN" "$(ident_one shnone a.sh 'say "the level floor"')"

D=$(ident_dir shansi)
cat > "$D/a.sh" <<'FIXTURE'
printf $'the floor is NFR8\n'
FIXTURE
run_ident "an ANSI-C quoted string"           1 "^BLOCKING .*NFR8" "$D"

# A heredoc body is data, exactly as `gate-lib.sh` reads it for the neighbouring
# problem: a payload at a delimiter the script names, not a line it writes. This
# suite's own fixtures are why that distinction has to hold.
D=$(ident_dir shheredoc)
cat > "$D/a.sh" <<'FIXTURE'
cat > fixture.ts <<EOF
const m = "the floor is NFR8";
EOF
FIXTURE
run_ident "a heredoc body is data"            0 "$CLEAN" "$D"

D=$(ident_dir shheredocquoted)
cat > "$D/a.sh" <<'FIXTURE'
cat > fixture.ts <<'EOF'
const m = "the floor is NFR8";
EOF
FIXTURE
run_ident "a quoted heredoc delimiter"        0 "$CLEAN" "$D"

D=$(ident_dir shheredoctab)
printf 'cat <<-EOF\n\tNFR8 in an indented body is data.\n\tEOF\nsay "the level floor"\n' > "$D/a.sh"
run_ident "a tab-stripping heredoc"           0 "$CLEAN" "$D"

run_ident "a here-string is not a heredoc" 1 "^BLOCKING .*NFR8" \
  "$(ident_one shherestring a.sh 'grep -q floor <<<"the floor is NFR8"')"

section "Spec identifiers: a shell comment is the record"
D=$(ident_dir shcomment)
cat > "$D/a.sh" <<'FIXTURE'
# The floor is NFR8, cited here rather than in the line below.
say "the level floor"
FIXTURE
run_ident "a comment above the string"        0 "$CLEAN" "$D"

run_ident "a trailing comment after a command" 0 "$CLEAN" \
  "$(ident_one shtrailing a.sh 'say "the level floor"  # the floor is NFR8')"
run_ident "a hash inside a string is not a comment" 1 "^BLOCKING .*#17" \
  "$(ident_one shhash a.sh 'say "eight of them, and #17 added the ninth"')"
run_ident "an argument count does not open a comment" 1 "^BLOCKING .*NFR8" \
  "$(ident_one shargc a.sh '[ $# -gt 0 ] && say "the floor is NFR8"')"

section "Spec identifiers: the ways the shell reader must not fail open"
# An apostrophe in a comment is the shell's version of one in JSX text: read as
# an opening quote, it swallows every string in the rest of the file.
D=$(ident_dir shapostrophe)
cat > "$D/a.sh" <<'FIXTURE'
# Don't stop reading here.
say "the floor is NFR8"
FIXTURE
run_ident "an apostrophe in a comment"        1 "a.sh:2:" "$D"

# The terminator ends the heredoc rather than the read: the body is skipped and
# the file resumes.
D=$(ident_dir shheredocresume)
cat > "$D/a.sh" <<'FIXTURE'
cat <<'EOF'
NFR8 in a heredoc body is data.
EOF
say "the floor is NFR9"
FIXTURE
run_ident "a heredoc terminator ends the body" 1 "^BLOCKING .*NFR9" "$D"

D=$(ident_dir shsubst)
cat > "$D/a.sh" <<'FIXTURE'
say "$(printf %s 'the floor is NFR8')"
FIXTURE
run_ident "a command substitution's body is code" 1 "^BLOCKING .*NFR8" "$D"

run_ident "an identifier-shaped variable"     0 "$CLEAN" \
  "$(ident_one shvar a.sh 'say "$NFR8 holds"')"
run_ident "the same variable, braced"         0 "$CLEAN" \
  "$(ident_one shbraced a.sh 'say "${NFR8} holds"')"
run_ident "an escaped quote inside a double-quoted string" 1 "^BLOCKING .*NFR8" \
  "$(ident_one shescape a.sh 'say "she said \"the floor is NFR8\""')"

D=$(ident_dir shsinglehash)
cat > "$D/a.sh" <<'FIXTURE'
say 'a # and a " inside single quotes'
say "the floor is NFR8"
FIXTURE
run_ident "a hash and a quote inside single quotes" 1 "^BLOCKING .*NFR8" "$D"

# The tree walk still skips `.agents/` and `.claude/`, and for shell that skip
# earns a second reason: THIS file's fixtures are the citations the gate refuses,
# so it cannot be subject to itself. Every other hook can be, and this is where
# it happens -- `//#test:gates` already declares `.claude/hooks/**` as an input,
# so editing a deny message re-runs this case.
D=$(ident_dir hooks)
cp "$HOOKS"/*.sh "$D/"
rm -f "$D/gate-test.sh"
run_ident "the hooks this repository owns"    0 "$CLEAN" "$D"

# Four holes /code-review found in the first draft of this reader, and every one
# of them failed OPEN: the file was reported clean. They are the shell half of
# what the `=>` cases above are for the JavaScript one, so they are grouped
# rather than scattered.
section "Spec identifiers: the four holes the shell reader failed open on"

# A `${ … }` is not only a name. Skipping it whole lost every word form, and the
# repo already writes user-facing text into one: `plan-to-design-gate.sh` puts a
# `${status:-unset}` in the middle of a refusal a person reads.
run_ident "a default in a parameter expansion" 1 "^BLOCKING .*NFR8" \
  "$(ident_one shdefault a.sh 'say "${MSG:-refused, the floor is NFR8}"')"
run_ident "an error word in a parameter expansion" 1 "^BLOCKING .*NFR8" \
  "$(ident_one sherrword a.sh ': "${MSG:?the floor is NFR8}"')"
run_ident "a pattern substitution's replacement" 1 "^BLOCKING .*NFR8" \
  "$(ident_one shpatsub a.sh 'say "${MSG//floor/the floor is NFR8}"')"
run_ident "a length is an operator, not a word" 0 "$CLEAN" \
  "$(ident_one shlength a.sh 'say "${#items[@]} of them, at the level floor"')"

# A heredoc marker takes quote removal and nothing else. Dropping every
# non-word character turned this delimiter into one no line matches, so the body
# ran to the end of the file and took every string with it.
D=$(ident_dir shheredochyphen)
cat > "$D/a.sh" <<'FIXTURE'
cat <<END-OF-MSG
body line
END-OF-MSG
say "the floor is NFR8"
FIXTURE
run_ident "a hyphenated heredoc delimiter"    1 "^BLOCKING .*NFR8" "$D"

D=$(ident_dir shheredocdotted)
cat > "$D/a.sh" <<'FIXTURE'
cat <<EOF.1
body line
EOF.1
say "the floor is NFR8"
FIXTURE
run_ident "a dotted heredoc delimiter"        1 "^BLOCKING .*NFR8" "$D"

D=$(ident_dir shheredocbackslash)
cat > "$D/a.sh" <<'FIXTURE'
cat <<\EOF
body line
EOF
say "the floor is NFR8"
FIXTURE
run_ident "a backslash-quoted heredoc delimiter" 1 "^BLOCKING .*NFR8" "$D"

# `<<` in arithmetic is a shift. Read as a heredoc marker it announced a body
# terminated by `2`, and swallowed the rest of the file.
D=$(ident_dir shshift)
cat > "$D/a.sh" <<'FIXTURE'
n=$(( 1 << 2 ))
say "the floor is NFR8, and n is $n"
FIXTURE
run_ident "a shift inside arithmetic"         1 "^BLOCKING .*NFR8" "$D"

D=$(ident_dir shshiftbare)
cat > "$D/a.sh" <<'FIXTURE'
(( n = 1 << 2 ))
say "the floor is NFR8"
FIXTURE
run_ident "a shift inside a bare arithmetic command" 1 "^BLOCKING .*NFR8" "$D"

section "Spec identifiers: the report, and the refusals"
D=$(ident_dir report)
cat > "$D/b.ts" <<'EOF'
const first = "clean";
const second = "clean";
const m = "the floor is NFR8";
EOF
run_ident "names the file, the line and the string" 1 "^ +the floor is NFR8$" "$D"
run_ident "names the line the string starts on"     1 "b.ts:3:" "$D"

run_ident "a root that does not exist"   2 "could not run" "$ROOT/ident/absent"
D=$(ident_dir notadir)
printf '%s\n' 'const m = 1;' > "$D/a.ts"
run_ident "a root that is a file"        2 "could not run" "$D/a.ts"
run_ident "an argument it does not know" 2 "could not run" "$(ident_dir unknownarg)" --wat
run_ident "a flag with no value"         2 "could not run" "$(ident_dir novalue)" --root
