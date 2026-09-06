# --- Where this tree's dev server answers ------------------------------------
#
# `dev-origin.mjs` is not a gate either, and it is driven here for the reason
# `ui-proof.mjs` and the page-weight script are: repo logic living in
# `scripts/`, and the alternative is a second test runner for one file.
#
# It runs against a **stubbed** proxy client, which is what makes these cases
# offline and deterministic. The script resolves that client out of the app's
# own `node_modules/.bin`, so a fixture is an app directory rather than an
# environment variable existing only for tests -- and stubbing it is the only
# way to hold "a route is registered" still, since the real answer depends on
# which dev servers happen to be running on this machine.
ORIGIN="$REPO/scripts/dev-origin.mjs"

# `routes` is what the stub's `list` prints, `get-url` what its `get` prints,
# and `fail` names a subcommand that should exit non-zero instead.
origin_app() { # name proxied-name get-url routes [fail-subcommand]
  local d="$ROOT/origin/$1"
  mkdir -p "$d/node_modules/.bin"
  if [ -n "$2" ]; then
    printf '{"name":"web","portless":{"name":"%s","script":"dev:app"}}\n' "$2" > "$d/package.json"
  else
    printf '{"name":"web"}\n' > "$d/package.json"
  fi
  printf '%s' "$4" > "$d/routes.txt"
  cat > "$d/node_modules/.bin/portless" <<STUB
#!/usr/bin/env bash
[ "\$1" = "${5:-}" ] && { echo "refused" >&2; exit 1; }
case "\$1" in
  get) echo "$3" ;;
  list) cat "$d/routes.txt" ;;
  *) exit 1 ;;
esac
STUB
  chmod +x "$d/node_modules/.bin/portless"
  echo "$d"
}

# stdout and stderr are captured apart, which is the point rather than
# tidiness: the caller is a command substitution, so a note landing on stdout
# becomes the origin a setup link is built against.
run_origin() { # name expect-exit want-stdout want-stderr app [extra arguments]
  local name="$1" expect="$2" want_out="$3" want_err="$4" app="$5"
  shift 5
  expect_run "$name" "$expect" "$want_out" "$want_err" -- node "$ORIGIN" --app "$app" "$@"
}

section "Dev origin: the route this tree's server registered"
LIVE=$(origin_app live web.example 'https://web.example.localhost' '
Active routes:

  https://web.example.localhost  ->  localhost:53321  (pid 4242)
')
run_origin "an active route is the origin to print"   0 '^https://web\.example\.localhost$' EMPTY "$LIVE"

# The confusion this exists to prevent: a worktree's hostname is the main
# checkout's with a branch prepended, so a containment test would answer yes to
# the wrong tree.
OTHER=$(origin_app other web.example 'https://web.example.localhost' '
Active routes:

  https://124-add-widget.web.example.localhost  ->  localhost:53321  (pid 4242)
')
run_origin "another tree's route is not this tree's"  0 EMPTY 'No active route' "$OTHER"

MINE=$(origin_app mine 124-add-widget.web.example 'https://124-add-widget.web.example.localhost' '
Active routes:

  https://web.example.localhost  ->  localhost:53320  (pid 4241)
  https://124-add-widget.web.example.localhost  ->  localhost:53321  (pid 4242)
')
run_origin "and it is picked out of several"          0 '^https://124-add-widget\.web\.example\.localhost$' EMPTY "$MINE"

# **A stub that answers helpfully hides the bug the code exists for.** The real
# client colours its output when `FORCE_COLOR` is in its environment -- which dev
# shells and CI images set -- and it wraps the arrow in the route line, so a
# naive line match finds nothing and reports "no route": the stale origin this
# whole script exists to stop, arrived at silently. Measured against the real
# client, not imagined.
COLOUR=$(origin_app colour web.example 'https://web.example.localhost' '
Active routes:

  https://web.example.localhost  '$'\033''[2m->'$'\033''[22m  localhost:53321  '$'\033''[2m(pid 4242)'$'\033''[22m
')
run_origin "a coloured route line is still a route"   0 '^https://web\.example\.localhost$' EMPTY "$COLOUR"

# The other half of that fix, and the one the real client actually promises:
# `NO_COLOR` is read ahead of `FORCE_COLOR` and ahead of any stdio test, so this
# stub colours exactly when the real one would and stays plain when asked.
HONOURS="$ROOT/origin/honours"
mkdir -p "$HONOURS/node_modules/.bin"
printf '{"name":"web","portless":{"name":"web.example"}}\n' > "$HONOURS/package.json"
cat > "$HONOURS/node_modules/.bin/portless" <<'STUB'
#!/usr/bin/env bash
arrow="->"
[ -n "${NO_COLOR:-}" ] || arrow=$'\033[2m->\033[22m'
case "$1" in
  get) echo "https://web.example.localhost" ;;
  list) printf '\nActive routes:\n\n  https://web.example.localhost  %s  localhost:53321  (pid 4242)\n' "$arrow" ;;
  *) exit 1 ;;
esac
STUB
chmod +x "$HONOURS/node_modules/.bin/portless"
run_origin "the colour opt-out reaches the client"    0 '^https://web\.example\.localhost$' EMPTY "$HONOURS"

section "Dev origin: a production shell is not asked at all"
# The same command enrols an Admin against a deployed database from an operator's
# laptop, where a dev server may well be running. Adopting its route there would
# print a setup link at a host reading an entirely different database. Exported
# rather than written as a prefix on the call: these runners are shell functions,
# and whether a prefix assignment outlives one is a bash setting rather than
# something a test should rest on.
NOBIN="$ROOT/origin/nobin"
mkdir -p "$NOBIN"
printf '{"name":"web","portless":{"name":"web.example"}}\n' > "$NOBIN/package.json"

export NODE_ENV=production
run_origin "production is answered with nothing"      0 EMPTY EMPTY "$LIVE"
run_origin "and a machine with no client is quiet"    0 EMPTY EMPTY "$NOBIN"
unset NODE_ENV

section "Dev origin: no answer is not the same as no route"
NONE=$(origin_app none web.example 'https://web.example.localhost' 'No active routes.
')
run_origin "nothing running prints nothing to stdout" 0 EMPTY 'No active route' "$NONE"
run_origin "and it names the hostname it looked for"  0 EMPTY 'web\.example\.localhost' "$NONE"

GETFAIL=$(origin_app getfail web.example 'https://web.example.localhost' '' get)
run_origin "a proxy that cannot name the route"       2 EMPTY 'could not' "$GETFAIL"

LISTFAIL=$(origin_app listfail web.example 'https://web.example.localhost' '' list)
run_origin "a proxy that cannot list its routes"      2 EMPTY 'could not' "$LISTFAIL"

NONAME=$(origin_app noname '' 'https://web.example.localhost' '')
run_origin "an app that declares no proxied name"     2 EMPTY 'could not' "$NONAME"

run_origin "an app with no proxy client installed"    2 EMPTY 'could not' "$NOBIN"
run_origin "and a refusal names what happens instead" 2 EMPTY 'falls back to the configured origin' "$NOBIN"

run_origin "an app directory that is not there"       2 EMPTY 'could not' "$ROOT/origin/absent"
run_origin "an argument it does not know"             2 EMPTY 'could not' "$LIVE" --wat
run_origin "a flag with no value"                     2 EMPTY 'could not' "$LIVE" --app
