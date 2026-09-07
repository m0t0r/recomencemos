# --- The artifact publisher -------------------------------------------------
#
# `ui-proof.mjs` is not a gate: it publishes rather than deciding whether work
# may proceed. It is driven here anyway, for the reason this suite already
# drives the audit and the migration gate -- it is repo logic living in
# `scripts/`, and the alternative is a second test runner for one file.
#
# Most cases run `--dry-run`, which is offline by construction: it reaches no
# pull request, no markdown renderer and no credential, so what is under test
# there is the part that decides *what would be published* -- the naming rule,
# the grouping into comparisons, and the two prefixes that carry the two
# lifetimes. The call that writes to the object store lives in its own module and
# is a dynamic import, so a dry run never loads it.
#
# The last two sections drive the real publish, still offline. They are the only
# place the object-store call, the four `gh` subprocesses and the body edit are
# exercised; what they need and what they cannot see is written above them.
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

# --- The upload path, offline ------------------------------------------------
#
# Everything above runs `--dry-run`, which reaches nothing by construction. What
# it therefore never touches is the half that holds a credential and a network:
# the object-store call, the four `gh` subprocesses, and the body edit that is
# the only part of this a reviewer actually sees.
#
# These two sections drive that half with no network, no container and no new
# dependency -- a fake `gh` earlier on PATH answering the four calls the
# publisher makes, and a stub HTTP server as the endpoint, which records every
# request and can be told to fail. They are worth their weight for a reason
# already paid twice: each defect this path has shipped was invisible to every
# dry-run case, because a dry run never constructs a client and never spawns a
# child. A bucket asked for as a hostname was the first; a subprocess handed its
# input through an option that does not exist was the second.
#
# **What no stub can check is that the signature is valid.** It sees a signed
# request and says "signed"; only a real S3 implementation verifies one, and a
# container in this suite is what CLAUDE.md refuses on the same grounds that keep
# a database out of `pnpm test`. Signature validity and real bucket semantics are
# section 5 of `docs/runbooks/ui-proof-artifacts.md`, checked once by a human,
# because signing does not drift.

# A subprocess that blocks is the failure mode this section is arranged against,
# and it has arrived twice. `timeout(1)` is GNU coreutils and is not on a stock
# macOS, so the deadline is here: the command runs in the background, is polled,
# and is killed at the limit. 124 is the code `timeout(1)` reports, kept so the
# number means the same thing to a reader who knows that tool.
#
# The point is that a wedged publisher costs this suite a bounded number of
# seconds rather than a CI job's whole timeout -- a case that hangs is worse than
# no case, because a red suite tells you something and a suite that never returns
# tells you nothing.
with_deadline() { # seconds cmd... -> echoes the exit code, or 124
  local limit="$1"
  shift
  "$@" &
  local pid=$! ticks=0
  while kill -0 "$pid" 2>/dev/null; do
    if [ "$ticks" -ge "$((limit * 10))" ]; then
      kill -9 "$pid" 2>/dev/null
      wait "$pid" 2>/dev/null
      echo 124
      return 0
    fi
    sleep 0.1
    ticks=$((ticks + 1))
  done
  wait "$pid"
  echo $?
}

# Every stub this file starts, so the trap can end them all. A background server
# outliving the suite is a held port and a leaked process on a developer's
# machine, and on a failing run it is the run that failed that leaks it.
STUBS=""
trap 'for stub in $STUBS; do kill "$stub" 2>/dev/null; done' EXIT

# **Not callable in a command substitution.** The stub's pid would be set in a
# subshell the caller cannot reach, so nothing would ever kill it and the suite
# would wait on a server nobody owns.
proof_env() { # dir -> writes bin/gh, starts the stub, writes "$d/port"
  local d="$1"
  mkdir -p "$d/bin"

  # The four calls the publisher makes, and no more. `api --method` and `pr edit`
  # both read stdin, and both record what they were given: that a body actually
  # crossed into the child is the regression guard for the defect named below,
  # and it cannot be seen from outside the child any other way.
  cat > "$d/bin/gh" <<'FAKEGH'
#!/usr/bin/env bash
{ printf 'gh'; for a in "$@"; do printf ' %s' "$a"; done; printf '\n'; } >> "$GH_LOG"
case "$1 $2" in
  "pr view")
    node -e 'const fs=require("fs");const b=fs.readFileSync(process.env.GH_BODY,"utf8");process.stdout.write(JSON.stringify({title:"A title",body:b||"Original body.",url:"u"}))' ;;
  "repo view")    printf '{"nameWithOwner":"owner/repo"}' ;;
  "api --method") cat > "$GH_RENDERED"; printf '<p>Original body.</p>' ;;
  "pr edit")      cat > "$GH_BODY" ;;
esac
FAKEGH
  chmod +x "$d/bin/gh"

  cat > "$d/stub.mjs" <<'STUB'
import { createServer } from "node:http";
import { appendFileSync, writeFileSync } from "node:fs";
const status = Number(process.env.STUB_STATUS ?? 200);
const server = createServer((req, res) => {
  let n = 0;
  req.on("data", (c) => (n += c.length));
  req.on("end", () => {
    const signed = /AWS4-HMAC-SHA256/.test(req.headers.authorization ?? "") ? "signed" : "unsigned";
    appendFileSync(
      process.env.PUT_LOG,
      `${req.method} ${req.url.split("?")[0]} ${req.headers["content-type"]} ${n} ${signed}\n`,
    );
    res.writeHead(status).end();
  });
});
server.listen(0, "127.0.0.1", () => writeFileSync(process.env.PORT_FILE, String(server.address().port)));
STUB

  : > "$d/put.log"
  : > "$d/gh.log"
  : > "$d/body.md"
  : > "$d/rendered.md"
  rm -f "$d/port"
  # Its own output goes to a file. A background process sharing this file's pipe
  # holds that pipe open and buffers the whole run's output until it dies, which
  # is how the first two attempts at this looked like hangs when they were not.
  PUT_LOG="$d/put.log" PORT_FILE="$d/port" STUB_STATUS="${STUB_STATUS:-200}" \
    node "$d/stub.mjs" > "$d/stub.log" 2>&1 &
  STUBS="$STUBS $!"
  for _ in $(seq 1 100); do
    [ -s "$d/port" ] && break
    sleep 0.05
  done
  [ -s "$d/port" ]
}

# The publisher's own stdout goes to a file rather than up the caller's pipe, for
# the reason above: this is called from a command substitution that reads the
# exit code, and a child holding that pipe would keep the substitution open.
#
# **`exec`, so the pid the deadline holds is the publisher's own.** `env` execs
# the shell and the shell execs `node`, which makes all three one process — and
# without the last of those, the deadline killed a wrapper and orphaned the node
# it had forked. Measured: two publishers survived the run that proved the
# deadline works, which is the leak this section is supposed to be the answer to.
proof_publish() { # dir port [arguments...] -> echoes the exit code
  local d="$1" port="$2"
  shift 2
  with_deadline 60 \
    env PATH="$d/bin:$PATH" \
      GH_LOG="$d/gh.log" \
      GH_BODY="$d/body.md" \
      GH_RENDERED="$d/rendered.md" \
      UI_PROOF_S3_ENDPOINT="http://127.0.0.1:$port" \
      UI_PROOF_S3_BUCKET="stub-bucket" \
      UI_PROOF_S3_ACCESS_KEY_ID="AKIAEXAMPLE" \
      UI_PROOF_S3_SECRET_ACCESS_KEY="secretexample" \
      UI_PROOF_PUBLIC_BASE="https://cdn.example.test" \
      AWS_MAX_ATTEMPTS=1 \
      bash -c 'cd "$1" && shift && exec node "$@" > out.log 2>&1' _ "$d" "$PROOF" "$@"
}

# One publish, many assertions: the run is the expensive part of this section and
# repeating it per case would say nothing extra. Both of these are a line over
# `ok`/`ko`, the way `lib.sh` asks -- the arguments they add are this gate's, the
# bookkeeping is not.
in_file() { # name file pattern
  if grep -qE -- "$3" "$2" 2>/dev/null; then
    ok "$1" "matched /$3/"
  else
    ko "$1" "no /$3/ in $(basename "$2")" "$(head -c 400 "$2" 2>/dev/null)"
  fi
}

not_in_file() { # name file pattern
  if grep -qE -- "$3" "$2" 2>/dev/null; then
    ko "$1" "found /$3/ in $(basename "$2") and should not have"
  else
    ok "$1" "no /$3/"
  fi
}

section "Artifact publisher: the upload path, offline"
# The deadline itself, first and cheaply. Everything below trusts it to turn a
# wedged subprocess into a failing case, so it is worth one second to know that
# it does rather than to find out that it does not on the run that needs it.
expect_run "a blocked subprocess is killed, not waited on" 0 "^124$" -- with_deadline 1 sleep 30
D=$(proof_repo upload)
proof_file "$D" before-publish-form.png
proof_file "$D" after-publish-form.png
proof_file "$D" demo-publish-a-profile.webm
PORT=""
proof_env "$D" && PORT=$(cat "$D/port")
if [ -n "$PORT" ]; then
  CODE=$(proof_publish "$D" "$PORT" publish --pr 42)
  if [ "$CODE" = 0 ]; then
    ok "a real publish against a stub store" "exit 0"
  else
    ko "a real publish against a stub store" "exit $CODE" "$(head -c 600 "$D/out.log")"
  fi

  # **The body has to reach the child, and only the child can say that it did.**
  # The async form of `execFile` has no `input` option -- that belongs to the
  # sync one -- and ignores the key in silence, so the markdown call sat on a
  # stdin pipe nothing would ever write to or close. From outside, that read as a
  # hang in the object-store client: three `gh` calls logged, the durable warning
  # printed, an empty upload log, and nine minutes of nothing. This case is the
  # only thing in the suite that would notice it come back.
  in_file "the markdown call is given the body on stdin" "$D/rendered.md" "Original body\."

  # Path-style: the bucket is the first path segment and never a subdomain. The
  # SDK defaults the other way, and against an endpoint with no DNS that hangs.
  in_file "the bucket is a path segment, not a hostname" "$D/put.log" '^PUT /stub-bucket/'
  not_in_file "no request is unsigned" "$D/put.log" 'unsigned'
  in_file "the review page lands under review/" "$D/put.log" \
    '/stub-bucket/review/pr-42-[0-9a-f]{16}/index\.html text/html'
  in_file "a comparison still lands beside it" "$D/put.log" \
    '/review/pr-42-[0-9a-f]{16}/before-publish-form\.png image/png'
  in_file "the demo lands under demos/" "$D/put.log" \
    '/stub-bucket/demos/pr-42-[0-9a-f]{16}/demo-publish-a-profile\.webm video/webm'
  in_file "the durable page lands beside the demo" "$D/put.log" \
    '/stub-bucket/demos/pr-42-[0-9a-f]{16}/index\.html text/html'
  not_in_file "no demo is written under review/" "$D/put.log" 'review/[^ ]*demo-'
  in_file "every upload reports itself" "$D/out.log" 'uploaded demos/pr-42'

  # The body edit is the last step, and it is what a reviewer actually sees.
  in_file "the body gains the block" "$D/body.md" 'ui-proof:begin'
  in_file "the review link is the published origin" "$D/body.md" \
    'cdn\.example\.test/review/pr-42-[0-9a-f]{16}/index\.html'
  in_file "the durable link is on its own line" "$D/body.md" 'The story, kept'
  in_file "the prose it started with survives" "$D/body.md" '^Original body\.'

  # Expiry: the same body, run again through the other subcommand.
  CODE=$(proof_publish "$D" "$PORT" expire --pr 42)
  if [ "$CODE" = 0 ]; then
    ok "expiry runs against the body publish left" "exit 0"
  else
    ko "expiry runs against the body publish left" "exit $CODE" "$(head -c 600 "$D/out.log")"
  fi
  in_file "expiry rewrites the block in place" "$D/body.md" 'no longer linked'
  in_file "and still names what it showed" "$D/body.md" 'It showed publish-a-profile, publish-form'
  in_file "the durable link survives expiry" "$D/body.md" 'cdn\.example\.test/demos/pr-42'
  not_in_file "the review link is gone" "$D/body.md" 'cdn\.example\.test/review/'
  in_file "the prose still survives" "$D/body.md" '^Original body\.'
else
  ko "the upload path, offline" "the stub endpoint would not start"
fi

section "Artifact publisher: an object store that refuses"
# A store that answers 500 must not leave the pull request body claiming an
# artifact that is not there. The publisher edits the body only after every
# upload has succeeded, and this is what holds that ordering.
D=$(proof_repo uploadfail)
proof_file "$D" after-publish-form.png
PORT=""
STUB_STATUS=500 proof_env "$D" && PORT=$(cat "$D/port")
if [ -n "$PORT" ]; then
  CODE=$(proof_publish "$D" "$PORT" publish --pr 42)
  # 124 is the deadline, and it would be a hang rather than a refusal. A failing
  # upload has to *fail*, promptly and by itself.
  if [ "$CODE" != 0 ] && [ "$CODE" != 124 ]; then
    ok "a failing upload is not a success" "exit $CODE"
  else
    ko "a failing upload is not a success" "exit $CODE" "$(head -c 600 "$D/out.log")"
  fi
  not_in_file "and the body is never edited" "$D/body.md" 'ui-proof:begin'
  not_in_file "so no link is left pointing at nothing" "$D/body.md" 'cdn\.example\.test'
else
  ko "an object store that refuses" "the stub endpoint would not start"
fi
