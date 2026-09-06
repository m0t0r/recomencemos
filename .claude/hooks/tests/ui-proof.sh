# --- The artifact publisher -------------------------------------------------
#
# `ui-proof.mjs` is not a gate: it publishes rather than deciding whether work
# may proceed. It is driven here anyway, for the reason this suite already
# drives the audit and the migration gate -- it is repo logic living in
# `scripts/`, and the alternative is a second test runner for one file.
#
# Every case runs `--dry-run`, which is offline by construction: it reaches no
# pull request, no markdown renderer and no credential, so what is under test is
# the part that decides *what would be published* -- the naming rule, the
# grouping into comparisons, and the two prefixes that carry the two lifetimes.
# The single call that writes to the object store lives in its own module and is
# never imported on this path.
PROOF="$REPO/scripts/ui-proof.mjs"

# The script derives its directory from `git rev-parse --show-toplevel`, so a
# fixture is a repository -- the same reason the migration gate's fixtures are.
proof_repo() { # name -> path
  local d="$ROOT/proof/$1"
  mkdir -p "$d/.artifacts/ui-proof"
  git -C "$d" init -q 2>/dev/null
  echo "$d"
}

# A capture has to be big enough to be one, so fixtures are padded past the
# floor. A deliberately truncated fixture is written by hand where that is the
# case under test.
proof_file() { # dir filename
  head -c 2048 /dev/zero | tr '\0' 'x' > "$1/.artifacts/ui-proof/$2"
}

run_proof() { # name expect-exit expect-grep dir [extra arguments]
  local name="$1" expect="$2" want="$3" dir="$4"
  shift 4
  expect_run "$name" "$expect" "$want" -- in_dir "$dir" node "$PROOF" "$@"
}

# The ordinary call: a dry-run publish against pull request 42.
run_pub() { # name expect-exit expect-grep dir
  run_proof "$1" "$2" "$3" "$4" publish --pr 42 --dry-run
}

section "Artifact publisher: the two lifetimes"
D=$(proof_repo lifetimes)
proof_file "$D" before-publish-form.png
proof_file "$D" after-publish-form.png
proof_file "$D" demo-publish-a-profile.webm
run_pub "a review capture takes the expiring prefix"  0 "review/pr-42-[0-9a-f]{16}/after-publish-form\.png" "$D"
run_pub "a demo takes the durable prefix"             0 "demos/pr-42-[0-9a-f]{16}/demo-publish-a-profile\.webm" "$D"
# The durable half needs a viewer that outlives the review prefix: a page under
# `review/` would be deleted out from under the clips it renders.
run_pub "the durable half gets a page of its own"     0 "demos/pr-42-[0-9a-f]{16}/index\.html" "$D"
run_pub "the review half gets its own page too"       0 "review/pr-42-[0-9a-f]{16}/index\.html" "$D"
run_pub "both pages are counted"                      0 "would publish 5 object" "$D"
run_pub "the link points at the review page"          0 "would link review/pr-42-.*/index\.html" "$D"
run_pub "a demo never lands under review/"            0 "^ +demos/pr-42-[0-9a-f]{16}/demo-publish-a-profile" "$D"
# A demo is the irreversible half, and the script cannot see the ticket graph
# that decides whether one is owed. So it says so rather than deciding quietly.
run_pub "publishing a demo is called out"             0 "durable clip.*never expire" "$D"
# Both prefixes are unguessable. The demo prefix is the one a guessable name
# would expose for longest, because nothing ever deletes it.
run_pub "the demo prefix is unguessable too"          0 "demos/pr-42-[0-9a-f]{16}/" "$D"

section "Artifact publisher: no demo, no second page"
D=$(proof_repo nodemo)
proof_file "$D" before-publish-form.png
proof_file "$D" after-publish-form.png
run_pub "one page when nothing is durable"            0 "would publish 3 object" "$D"
# A negative match, which the pattern form cannot express.
if in_dir "$D" node "$PROOF" publish --pr 42 --dry-run 2>&1 | grep -q "demos/"; then
  ko "no durable prefix is invented" "a durable prefix appeared with no demo"
else
  ok "no durable prefix is invented" "no demos/ prefix"
fi

section "Artifact publisher: names it refuses"
# No separator at all, so there is no state to read -- distinct from a name that
# has one and gets it wrong, which is the case below.
D=$(proof_repo nostate); proof_file "$D" screenshot.png
run_pub "a capture with no state"        1 "no state" "$D"
D=$(proof_repo badstate); proof_file "$D" beofre-publish-form.png
run_pub "a misspelled state"             1 "not one of before, after or demo" "$D"
D=$(proof_repo nosurface); proof_file "$D" after-.png
run_pub "a state with no surface"        1 "names a state but no surface" "$D"
# The link block records surfaces as a ", "-joined list so the expiry step can
# read them back. A surface carrying that separator would split into two.
D=$(proof_repo commasurface); proof_file "$D" "after-sign, in.png"
run_pub "a surface the link block cannot round-trip" 1 "round-trip" "$D"
# A file the script has no opinion about is ignored rather than refused: an
# operator's scratch notes beside the captures are not an error.
D=$(proof_repo ignores); proof_file "$D" after-publish-form.png
printf 'notes\n' > "$D/.artifacts/ui-proof/README.txt"
run_pub "an unrelated file is ignored, not refused" 0 "would publish 2 object" "$D"

section "Artifact publisher: nothing to publish"
D=$(proof_repo empty)
run_pub "an empty capture directory"     1 "nothing captured" "$D"
D="$ROOT/proof/absent"; mkdir -p "$D"; git -C "$D" init -q 2>/dev/null
run_pub "no capture directory at all"    1 "nothing captured" "$D"

section "Artifact publisher: a capture that is not one"
# The ffmpeg failure seen from the other end. `record start` reports success and
# `record stop` is where it breaks, so the wreckage is a truncated file rather
# than a missing one -- and an empty file publishes as a player showing nothing,
# which reads to a reviewer as a change that does nothing.
D=$(proof_repo truncated); proof_file "$D" before-publish-form.png
printf 'x' > "$D/.artifacts/ui-proof/after-publish-form.webm"
run_pub "a truncated recording"          1 "not a capture" "$D"
run_pub "and it names the file"          1 "after-publish-form\.webm" "$D"
D=$(proof_repo zero); : > "$D/.artifacts/ui-proof/after-publish-form.webm"
run_pub "a zero-byte recording"          1 "not a capture" "$D"

section "Artifact publisher: an unpaired comparison"
# Reported, never refused. A session that captured only one half has to say why
# in the pull request body, and dropping the file here would take that decision
# away from it -- so the half is published and the gap is named.
D=$(proof_repo unpaired); proof_file "$D" after-sign-in.webm
run_pub "an after with no before is named"   0 "has an after and no before" "$D"
run_pub "and it is still published"          0 "would publish 2 object"     "$D"
D=$(proof_repo unpaired2); proof_file "$D" before-sign-in.webm
run_pub "a before with no after is named"    0 "has a before and no after"  "$D"

section "Artifact publisher: refusals that are not answers"
D=$(proof_repo args); proof_file "$D" after-publish-form.png
run_proof "no pull request number"      2 "usage|--pr" "$D" publish --dry-run
run_proof "a command it does not know"  2 "usage"      "$D" ship --pr 42
run_proof "a pull request that is not a number" 2 "--pr" "$D" publish --pr abc --dry-run
# A real publish refuses before it makes a single network call, and it refuses
# with 1 rather than 2: an operator who has not worked the runbook yet is the
# ordinary state of a machine, not a broken script.
run_proof "an unconfigured store refuses with 1" 1 "not configured" "$D" publish --pr 42
run_proof "and it names every missing variable"  1 "UI_PROOF_PUBLIC_BASE" "$D" publish --pr 42

