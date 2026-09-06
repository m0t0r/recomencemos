# `coverage-merge.mjs` is not a gate either -- it decides nothing about whether
# work may proceed -- and it is driven here for the reason `ui-proof.mjs`, the
# page-weight script and `dev-origin.mjs` are: repo logic living in `scripts/`,
# and the alternative is a second test runner for one file.
#
# What is under test is the arithmetic and the refusals, and the two are the same
# argument. A merge that quietly dropped a workspace, or echoed one workspace's
# total as the repository's, would publish a number on every pull request that
# looks like an answer and is not -- so every way it cannot reach an answer has
# to cost an exit `2` rather than a partial report.
MERGE="$REPO/scripts/coverage-merge.mjs"

# A fixture is a real directory tree, because the script's frame is
# `pnpm-workspace.yaml` plus what it finds through it -- there is nothing left to
# stub that would still be the thing under test.
cov_repo() { # name [packages-block]
  local d="$ROOT/merge/$1"
  mkdir -p "$d"
  printf '%s' "${2:-$(printf 'packages:\n  - "packages/*"\n')}" > "$d/pnpm-workspace.yaml"
  printf '{"name":"root"}\n' > "$d/package.json"
  echo "$d"
}

# One metric entry, spelled out once so a case reads as its numbers.
cov_metric() { # metric total covered
  printf '"%s":{"total":%s,"covered":%s,"skipped":0,"pct":0}' "$1" "$2" "$3"
}

cov_ws() { # repo workspace summary [final]
  local d="$1/packages/$2" final="${4:-}"
  # Spelled as a variable rather than `${4:-{}}`: brace expansion makes the
  # inline default write a literal backslash pair, which every case then fails
  # on as invalid JSON rather than on what it was written to test.
  [ -n "$final" ] || final='{}'
  mkdir -p "$d/coverage"
  printf '{"name":"@repo/%s","scripts":{"test:coverage":"vitest run --coverage"}}\n' "$2" \
    > "$d/package.json"
  printf '%s' "$3" > "$d/coverage/coverage-summary.json"
  printf '%s' "$final" > "$d/coverage/coverage-final.json"
}

# Declares the script and leaves no report: the case the fail-closed rule is for.
cov_ws_bare() { # repo workspace
  local d="$1/packages/$2"
  mkdir -p "$d"
  printf '{"name":"@repo/%s","scripts":{"test:coverage":"vitest run --coverage"}}\n' "$2" \
    > "$d/package.json"
}

# A workspace with tests but no coverage script is not measured and owes no
# report -- skipping it is correct, and refusing it would make adding a workspace
# a broken build.
cov_ws_unmeasured() { # repo workspace
  local d="$1/packages/$2"
  mkdir -p "$d"
  printf '{"name":"@repo/%s","scripts":{"test":"vitest run"}}\n' "$2" > "$d/package.json"
}

run_merge() { # name expect-exit want-stdout want-stderr repo [extra arguments]
  local name="$1" expect="$2" want_out="$3" want_err="$4" repo="$5"
  shift 5
  expect_run "$name" "$expect" "$want_out" "$want_err" -- node "$MERGE" --root "$repo" "$@"
}

# Greps the merged summary the run left behind, which is the only way to assert
# what a reader of the pull-request comment will actually see.
run_written() { # name repo pattern
  expect_run "$1" 0 - -- grep -qE -- "$3" "$2/coverage/coverage-summary.json"
}

section "Coverage merge: the total is the sum, not a workspace's"

# Both workspaces claim 100% in their own `total` while their file rows say
# otherwise. The merged total must come from the rows, so a merge that trusted
# either `total` fails all three of these.
TWO=$(cov_repo two)
cov_ws "$TWO" alpha \
  "{\"total\":{$(cov_metric lines 1 1)},\"/r/a.ts\":{$(cov_metric lines 10 5)}}" \
  '{"/r/a.ts":{"path":"/r/a.ts"}}'
cov_ws "$TWO" beta \
  "{\"total\":{$(cov_metric lines 1 1)},\"/r/b.ts\":{$(cov_metric lines 30 10)}}" \
  '{"/r/b.ts":{"path":"/r/b.ts"}}'

run_merge  "two workspaces merge into one report"     0 'Merged 2 workspaces, 2 files' EMPTY "$TWO"
run_written "the summed line total is 15 of 40"       "$TWO" '"total":40'
run_written "and the percentage is taken from the sum" "$TWO" '"pct":37\.5'
run_written "a workspace's own total is discarded"    "$TWO" '"covered":15'
run_written "both file rows survive the union"        "$TWO" '/r/b\.ts'

# The final report is the action's other input, and a merge that wrote only the
# summary would leave the per-file rows empty with no error anywhere.
run_written "the final report is merged too"          "$TWO" '.'
expect_run "coverage-final.json is a union as well" 0 - -- grep -q '/r/b.ts' "$TWO/coverage/coverage-final.json"

# A metric this repository has not seen must be summed rather than dropped:
# istanbul's `branchesTrue` is the live example, and hardcoding four metric names
# is how it would silently vanish from the total.
EXTRA=$(cov_repo extra)
cov_ws "$EXTRA" alpha \
  "{\"total\":{},\"/r/a.ts\":{$(cov_metric lines 4 2),$(cov_metric branchesTrue 8 6)}}"
run_merge  "an unfamiliar metric is merged"           0 'branchesTrue' EMPTY "$EXTRA"
run_written "and it is summed rather than dropped"    "$EXTRA" '"branchesTrue":\{"total":8,"covered":6'

# Istanbul's own answer for a file with nothing to cover is 100%, not 0 and not
# NaN. A division written without the guard puts `null` in the JSON the action
# reads and renders a blank cell.
NOTHING=$(cov_repo nothing)
cov_ws "$NOTHING" alpha "{\"total\":{},\"/r/a.ts\":{$(cov_metric lines 0 0)}}"
run_merge  "a file with nothing to cover is 100%"     0 '100' EMPTY "$NOTHING"
run_written "and no NaN reaches the written summary"  "$NOTHING" '"pct":100'

section "Coverage merge: it refuses rather than reporting a partial answer"

# The failure this whole section is arranged against: a workspace ran no
# coverage, its files are absent from the merge, and the total published on the
# pull request is the rest of the repository wearing the repository's name.
MISSING=$(cov_repo missing)
cov_ws "$MISSING" alpha "{\"total\":{},\"/r/a.ts\":{$(cov_metric lines 4 2)}}"
cov_ws_bare "$MISSING" beta
run_merge  "a measured workspace that left no report" 2 EMPTY 'not found' "$MISSING"
run_merge  "and the refusal names the missing file"   2 EMPTY 'coverage-summary\.json' "$MISSING"
run_merge  "and says which command should have run"   2 EMPTY 'test:coverage' "$MISSING"

# Two workspaces claiming one file means their `include` globs overlap, and
# there is no correct answer available: taking either understates it and summing
# double-counts every line.
CLASH=$(cov_repo clash)
cov_ws "$CLASH" alpha "{\"total\":{},\"/r/same.ts\":{$(cov_metric lines 4 2)}}"
cov_ws "$CLASH" beta  "{\"total\":{},\"/r/same.ts\":{$(cov_metric lines 4 4)}}"
run_merge  "one file measured by two workspaces"      2 EMPTY 'both' "$CLASH"
run_merge  "and the refusal names the file"           2 EMPTY 'same\.ts' "$CLASH"
run_merge  "and names both workspaces"                2 EMPTY 'packages/beta' "$CLASH"

# An unparsed `packages:` would leave nothing measured and print a clean run
# over an empty merge -- the same failing-open shape the dependency audit's own
# cases exist for.
EMPTYWS=$(cov_repo emptyws "$(printf 'packages:\n')")
run_merge  "a workspace list read as empty"           2 EMPTY 'read as empty' "$EMPTYWS"

NOKEY=$(cov_repo nokey "$(printf 'onlyBuiltDependencies:\n  - esbuild\n')")
run_merge  "a manifest declaring no packages key"     2 EMPTY 'packages' "$NOKEY"

NONE2=$(cov_repo none2)
cov_ws_unmeasured "$NONE2" alpha
run_merge  "no workspace declares the script at all"  2 EMPTY 'no workspace declares' "$NONE2"

# The other side of that: an unmeasured workspace beside a measured one is
# skipped, not refused. Refusing would make adding a workspace break the build.
MIXED=$(cov_repo mixed)
cov_ws "$MIXED" alpha "{\"total\":{},\"/r/a.ts\":{$(cov_metric lines 4 2)}}"
cov_ws_unmeasured "$MIXED" beta
run_merge  "a workspace without the script is skipped" 0 'Merged 1 workspaces' EMPTY "$MIXED"

BROKEN=$(cov_repo broken)
cov_ws "$BROKEN" alpha 'not json at all'
run_merge  "a report that is not valid JSON"          2 EMPTY 'not valid JSON' "$BROKEN"

run_merge  "an argument it does not know"             2 EMPTY 'unknown argument' "$TWO" --wat
run_merge  "a flag with no value"                     2 EMPTY 'needs a value' "$TWO" --root

