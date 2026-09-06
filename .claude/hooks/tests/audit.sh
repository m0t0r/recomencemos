# The dependency audit is not a hook, but it is the same kind of thing: repo
# logic deciding whether work may proceed. Its fixture repository is built here
# in four shapes, because the way this gate fails open is by failing to read a
# workspace file and then counting only the root manifest as direct.
AUDIT="$REPO/scripts/audit-direct.mjs"

mkaudit() { # dir packages-block
  local dir="$1"
  mkdir -p "$dir/packages/thing" "$dir/apps/app"
  printf '%s' "$2" > "$dir/pnpm-workspace.yaml"
  printf '%s\n' '{"name":"root","devDependencies":{"turbo":"^2.10.11"}}' > "$dir/package.json"
  printf '%s\n' '{"name":"thing","dependencies":{"next":"16.3.2"}}' > "$dir/packages/thing/package.json"
  printf '%s\n' '{"name":"app","devDependencies":{"vitest":"^4"}}' > "$dir/apps/app/package.json"
}

AR="$ROOT/audit-block"
mkaudit "$AR" 'packages:
  - "apps/*"
  - "packages/*"
'
# Flow style, and a block interrupted by a blank line and a comment: both are
# valid YAML this gate used to read as "no workspaces", which made a workspace
# dependency look transitive and exit 0.
AR_FLOW="$ROOT/audit-flow"
mkaudit "$AR_FLOW" 'packages: ["apps/*", "packages/*"]
'
AR_GAPS="$ROOT/audit-gaps"
mkaudit "$AR_GAPS" 'packages:
  # the app
  - "apps/*"

  - "packages/*"

publicHoistPattern:
  - "next"
'
AR_BROKEN="$ROOT/audit-broken"
mkaudit "$AR_BROKEN" 'engineStrict: true
'

# One advisory, parameterised by the two fields the gate actually reads.
adv() { jq -nc --arg m "$1" --arg s "$2" \
  '{advisories:{"1":{module_name:$m,severity:$s,title:"fixture",vulnerable_versions:"<1",patched_versions:">=1",url:"https://example.test"}}}'; }

run_audit() { # name expect-exit expect-grep root json
  printf '%s' "$5" > "$ROOT/audit-input.json"
  expect_run "$1" "$2" "$3" -- node "$AUDIT" --root "$4" --input "$ROOT/audit-input.json"
}

section "Dependency audit: high or above, direct only"
run_audit "high in a dependency of a workspace"           1 "^BLOCKING .*next"     "$AR"        "$(adv next high)"
run_audit "critical in a dependency of a workspace"       1 "^BLOCKING .*critical" "$AR"        "$(adv next critical)"
run_audit "high in a root devDependency"                  1 "^BLOCKING .*turbo"    "$AR"        "$(adv turbo high)"
run_audit "high in a workspace devDependency"             1 "^BLOCKING .*vitest"   "$AR"        "$(adv vitest high)"
run_audit "high with no direct path at all"               0 "^transitive .*postcss" "$AR"       "$(adv postcss high)"
run_audit "moderate in a direct dependency"               0 "passed: 0 blocking"   "$AR"        "$(adv next moderate)"
run_audit "low in a direct dependency"                    0 "passed: 0 blocking"   "$AR"        "$(adv next low)"
run_audit "nothing found"                                 0 "passed: 0 blocking"   "$AR"        '{"advisories":{}}'

section "Dependency audit: the ways it must not fail open"
run_audit "flow-style packages: still finds the workspace" 1 "^BLOCKING .*next"    "$AR_FLOW"   "$(adv next high)"
run_audit "comments and blank lines inside the block"      1 "^BLOCKING .*next"    "$AR_GAPS"   "$(adv next high)"
run_audit "a workspace file with no packages: key"         2 "could not run"       "$AR_BROKEN" "$(adv next high)"
run_audit "an audit payload that is not an audit"          2 "could not run"       "$AR"        '{"error":"registry unreachable"}'
run_audit "an audit payload that is not JSON"              2 "not JSON"            "$AR"        'upstream said no'


# The reporting half of the same pair. It shares `audit-lib.mjs` with the gate
# above, so these reuse that gate's fixtures deliberately: if the two ever
# disagreed about which dependency is direct, these cases and those would have to
# disagree too, which is the whole reason the reading lives in one file.
REPORT="$REPO/scripts/audit-report.mjs"

run_report() { # name expect-exit expect-grep root json
  printf '%s' "$5" > "$ROOT/audit-input.json"
  expect_run "$1" "$2" "$3" -- node "$REPORT" --root "$4" --input "$ROOT/audit-input.json"
}

# Two advisories in one payload, parameterised so the same pair can be fed in
# either order. That is what the fingerprint stability case needs.
advs() { jq -nc --arg m1 "$1" --arg s1 "$2" --arg m2 "$3" --arg s2 "$4" \
  '{advisories:{
     "1":{module_name:$m1,severity:$s1,title:"one",vulnerable_versions:("<"+$m1),patched_versions:">=1",url:"https://example.test/1"},
     "2":{module_name:$m2,severity:$s2,title:"two",vulnerable_versions:("<"+$m2),patched_versions:">=2",url:"https://example.test/2"}}}'; }

# The fingerprint of one ordering, read back out of the report itself, so the
# case below asserts against what the script actually produces rather than
# against a hash restated here that could drift from it.
fingerprint_of() { # json
  printf '%s' "$1" > "$ROOT/audit-fp.json"
  node "$REPORT" --root "$AR" --input "$ROOT/audit-fp.json" 2>/dev/null \
    | sed -n 's/.*audit-fingerprint: \([0-9a-f]*\).*/\1/p'
}
FP_ONE=$(fingerprint_of "$(advs next high postcss moderate)")

section "Dependency report: what reaches a person"
run_report "a transitive high the blocking gate lets past"  1 "postcss.*transitively"  "$AR" "$(adv postcss high)"
run_report "a transitive moderate, below the blocking bar"  1 "moderate"               "$AR" "$(adv postcss moderate)"
run_report "a direct high says every PR is already red"     1 "already failing"        "$AR" "$(adv next high)"
run_report "a direct moderate does not claim CI is red"     1 "None of these blocks"   "$AR" "$(adv next moderate)"
run_report "a direct dependency is named as direct"         1 "next.*directly"         "$AR" "$(adv next high)"
run_report "a critical is reported, not just high"          1 "critical"               "$AR" "$(adv next critical)"
run_report "low is below the reporting threshold"           0 "nothing at moderate"    "$AR" "$(adv next low)"
run_report "info is below it too"                           0 "nothing at moderate"    "$AR" "$(adv next info)"
run_report "nothing found at all"                           0 "nothing at moderate"    "$AR" '{"advisories":{}}'

# The workflow says nothing when the fingerprint is unchanged, so a fingerprint
# that moved on its own would post a comment a day about an unchanged finding,
# and one that never moved would hide a genuinely new advisory.
section "Dependency report: the fingerprint the workflow deduplicates on"
run_report "a finding carries one"                          1 "audit-fingerprint: [0-9a-f]{16}" "$AR" "$(adv next high)"
run_report "the same set in the other order hashes alike"   1 "audit-fingerprint: $FP_ONE"      "$AR" "$(advs postcss moderate next high)"

# Inequality, which no `grep -E` pattern can express: POSIX ERE has no negative
# lookahead, so this compares the two values instead of matching one.
fp_differs() { # name other-json
  local other; other=$(fingerprint_of "$2")
  if [ -n "$other" ] && [ "$other" != "$FP_ONE" ]; then
    ok "$1" "$other"
  else
    ko "$1" "${other:-<none>} (want a value, differing from $FP_ONE)"
  fi
}

fp_differs "a changed severity is a different finding"     "$(advs next critical postcss moderate)"
fp_differs "a changed package is a different finding"      "$(advs turbo high postcss moderate)"

section "Dependency report: the ways it must not fail open"
run_report "a workspace file with no packages: key"         2 "could not run" "$AR_BROKEN" "$(adv next high)"
run_report "an audit payload that is not an audit"          2 "could not run" "$AR"        '{"error":"registry unreachable"}'
run_report "an audit payload that is not JSON"              2 "not JSON"      "$AR"        'upstream said no'

