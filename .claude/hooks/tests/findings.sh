# `findings.mjs` is how a machine files a `needs-triage` issue, and it is driven
# here because it used to be two `run:` blocks in two workflows that nothing
# ran until the day they ran for real. `gh` is a stub on PATH that logs every
# call and answers from fixture files; the dependency report underneath the
# `audit` subcommand is the real script against the audit fixtures, so what is
# under test is the lifecycle -- what gets filed, edited, closed or left alone.
FINDINGS="$REPO/scripts/findings.mjs"
REPORT="$REPO/scripts/audit-report.mjs"

# The stub. Every call lands in gh.log; a body arriving on stdin lands in
# body.txt; `issue list` answers with issues.json; `label create` refuses when
# a marker file says the label already exists, which is the case the script
# must shrug at.
BIN="$ROOT/bin"
mkdir -p "$BIN"
cat > "$BIN/gh" <<'STUB'
#!/usr/bin/env bash
printf 'gh %s\n' "$*" >> "$FIXTURE/gh.log"
case "$1 $2" in
  "issue list") cat "$FIXTURE/issues.json" ;;
  "issue create") cat > "$FIXTURE/body.txt"; echo "https://example.test/issues/99" ;;
  "issue edit") cat > "$FIXTURE/body.txt" ;;
  "label create") [ -f "$FIXTURE/label-exists" ] && { echo "already exists" >&2; exit 1; } ;;
  "issue comment" | "issue close") ;;
  *) echo "stub: unexpected gh $*" >&2; exit 1 ;;
esac
[ -f "$FIXTURE/gh-fails" ] && exit 1
exit 0
STUB
chmod +x "$BIN/gh"

# One fixture per case: a repository the report can read, an issue history, and
# an empty call log. `next` is a direct dependency, so an advisory on it is a
# finding and an advisory on `postcss` is a transitive one.
fixture() { # name [issues-json]
  local d="$ROOT/f/$1"
  mkdir -p "$d/packages/thing"
  printf 'packages:\n  - "packages/*"\n' > "$d/pnpm-workspace.yaml"
  printf '%s\n' '{"name":"root"}' > "$d/package.json"
  printf '%s\n' '{"name":"thing","dependencies":{"next":"16.3.2"}}' > "$d/packages/thing/package.json"
  printf '%s' "${2:-[]}" > "$d/issues.json"
  : > "$d/gh.log"
  echo "$d"
}

adv() { jq -nc --arg m "$1" --arg s "$2" \
  '{advisories:{"1":{module_name:$m,severity:$s,title:"fixture",vulnerable_versions:"<1",patched_versions:">=1",url:"https://example.test"}}}'; }

# The real fingerprint of the advisory the cases file, read out of the report
# rather than restated, so an issue body can carry the value the script will
# compute.
FIX0=$(fixture fp)
printf '%s' "$(adv next high)" > "$FIX0/input.json"
FP=$(node "$REPORT" --root "$FIX0" --input "$FIX0/input.json" 2>/dev/null | sed -n 's/.*audit-fingerprint: \([0-9a-f]*\).*/\1/p')

issue() { # number state fingerprint-or-empty
  local body="mislabelled by hand"
  [ -n "$3" ] && body="…<!-- audit-fingerprint: $3 -->"
  jq -nc --argjson n "$1" --arg s "$2" --arg b "$body" '{number:$n,state:$s,body:$b}'
}

run_audit() { # name expect-exit expect-grep fixture advisory-json
  printf '%s' "$5" > "$4/input.json"
  expect_run "$1" "$2" "$3" -- env "PATH=$BIN:$PATH" FIXTURE="$4" REPO=o/r RUN_URL=https://run.test \
    node "$FINDINGS" audit --root "$4" --input "$4/input.json"
}

# The call log is the assertion, not only the exit code: a lifecycle that
# exited 0 having closed the wrong issue would pass on the code alone.
calls() { # name fixture pattern
  expect_run "$1" 0 - -- grep -qE -- "$3" "$2/gh.log"
}
no_call() { # name fixture pattern
  if grep -qE -- "$3" "$2/gh.log"; then
    ko "$1" "the log carries /$3/ and must not"
  else
    ok "$1" "no such call"
  fi
}

section "Findings: a clean audit"
F=$(fixture clean)
run_audit "nothing to report, nothing open"          0 "no open finding to close" "$F" '{"advisories":{}}'
no_call   "and nothing is filed"                     "$F" "issue create"
calls     "the label is ensured anyway"              "$F" "^gh label create needs-triage"

F=$(fixture clean-open "[$(issue 7 OPEN "$FP")]")
run_audit "clean, with an open finding to close"     0 "closed #7" "$F" '{"advisories":{}}'
calls     "it is commented before it is closed"      "$F" "^gh issue comment 7 .*found nothing.*Run"
calls     "and then closed"                          "$F" "^gh issue close 7 --repo o/r"

F=$(fixture clean-mislabelled "[$(issue 8 OPEN "")]")
run_audit "clean, and a mislabelled open issue"      0 "no open finding to close" "$F" '{"advisories":{}}'
no_call   "is not the one that gets closed"          "$F" "issue close"

section "Findings: an audit with something to say"
F=$(fixture new)
run_audit "a first finding is filed"                 0 "^filed https://example.test/issues/99" "$F" "$(adv next high)"
calls     "under both labels"                        "$F" "^gh issue create .*--label needs-triage --label security-audit"
expect_run "and the body is the report"              0 - -- grep -q "audit-fingerprint: $FP" "$F/body.txt"

F=$(fixture same "[$(issue 7 OPEN "$FP")]")
run_audit "the same set as the open finding"         0 "#7 already describes this exact set" "$F" "$(adv next high)"
no_call   "is neither edited nor re-filed"           "$F" "issue (create|edit|comment)"

F=$(fixture moved "[$(issue 7 OPEN deadbeefdeadbeef)]")
run_audit "a set that moved edits the open finding"  0 "^updated #7" "$F" "$(adv next high)"
calls     "in place"                                 "$F" "^gh issue edit 7 --repo o/r --body-file -"
calls     "with a comment saying so"                 "$F" "^gh issue comment 7 .*advisories changed"
no_call   "and files nothing new"                    "$F" "issue create"

F=$(fixture dismissed "[$(issue 5 CLOSED "$FP")]")
run_audit "a closed issue with this set is a dismissal" 0 "#5 carries this exact set and was closed" "$F" "$(adv next high)"
no_call   "so nothing is re-filed"                   "$F" "issue create"

F=$(fixture other-dismissed "[$(issue 5 CLOSED deadbeefdeadbeef)]")
run_audit "a dismissal of a different set does not reach" 0 "^filed" "$F" "$(adv next high)"

F=$(fixture mislabelled "[$(issue 8 OPEN "")]")
run_audit "an open issue with the label and no marker" 0 "^filed" "$F" "$(adv next high)"
no_call   "is left alone"                            "$F" "issue (edit|close) 8"

F=$(fixture label-exists)
touch "$F/label-exists"
run_audit "a label that already exists is not fatal" 0 "^filed" "$F" "$(adv next high)"

section "Findings: the ways it must not fail open"
F=$(fixture broken)
printf 'engineStrict: true\n' > "$F/pnpm-workspace.yaml"
run_audit "a report that could not run is refused"   2 "could not run" "$F" "$(adv next high)"
no_call   "before any issue is touched"              "$F" "issue"

F=$(fixture gh-down)
touch "$F/gh-fails"
run_audit "gh failing is a refusal, not a clean run" 2 "gh issue list failed" "$F" '{"advisories":{}}'

expect_run "no repository named"                     2 "REPO" -- env "PATH=$BIN:$PATH" FIXTURE="$F" REPO= GITHUB_REPOSITORY= node "$FINDINGS" audit
expect_run "a subcommand it does not know"           2 "usage" -- env REPO=o/r node "$FINDINGS" ship

section "Findings: a control-band breach"
F=$(fixture breach)
expect_run "all four fields file one issue"          0 "^filed" -- env "PATH=$BIN:$PATH" FIXTURE="$F" REPO=o/r GITHUB_EVENT_NAME=repository_dispatch \
  BAND="p95 latency > 800ms" OBSERVED="1.2s over 15m" SURFACE="/offers/[id]" FIRST_CHECK="the pooler" node "$FINDINGS" breach
calls     "titled after the band"                    "$F" "^gh issue create --repo o/r --label needs-triage --title Control-band breach: p95 latency > 800ms --body-file -"
expect_run "the body carries every section"          0 - -- grep -q '^## First thing to check' "$F/body.txt"
expect_run "and names the event it came from"        0 - -- grep -q 'from a `repository_dispatch` event' "$F/body.txt"

F=$(fixture breach-short)
expect_run "a missing field is refused"              2 "::error::incomplete breach payload, missing: surface" - -- env "PATH=$BIN:$PATH" FIXTURE="$F" REPO=o/r \
  BAND=b OBSERVED=o SURFACE= FIRST_CHECK=f node "$FINDINGS" breach
no_call   "and nothing is filed"                     "$F" "issue create"
