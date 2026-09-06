# The page-weight measurement is the third non-hook in this file, and it is here
# for the reason `audit-report.mjs` is: it blocks nothing and still has to be
# right, because the number it prints is what a requirement gets judged against.
# It is also the one whose failure mode is already on the record -- every figure
# this repository carried was about 39 KB high for two efforts, because the
# method counted a bundle no browser fetches. So most of what follows is about
# what it must *not* count, and about the several ways it can be handed a
# question it cannot answer.
WEIGH="$REPO/scripts/first-load-bytes.mjs"

# One fixture build, shared. Chunks are random base64 rather than repeated
# characters: a kilobyte of `aaaa` gzips to almost nothing, and every row would
# then round to `0 KB` whether the script summed correctly or not.
#
# The legacy chunk is an order of magnitude larger than the others on purpose.
# That is what makes "excluded" assertable by digit count: counted, the totals
# below would be three digits, and the cases assert two.
PW="$ROOT/page-weight"
mkdir -p "$PW/.next/static/chunks" "$PW/.next/server/app"
pw_chunk() { # name kilobytes
  head -c $(( $2 * 1024 )) /dev/urandom | base64 > "$PW/.next/static/chunks/$1.js"
}
pw_doc() { # route-slug html
  printf '%s\n' "$2" > "$PW/.next/server/app/$1.html"
}
pw_chunk one 40
pw_chunk two 40
pw_chunk legacy 400

run_weigh_in() { # name app expect-exit expect-grep [extra arguments]
  local name="$1" app="$2" expect="$3" want="$4"
  shift 4
  expect_run "$name" "$expect" "$want" -- node "$WEIGH" --app "$app" "$@"
}

run_weigh() { # name expect-exit expect-grep [extra arguments]
  local name="$1" expect="$2" want="$3"
  shift 3
  run_weigh_in "$name" "$PW" "$expect" "$want" "$@"
}

section "Page weight: what the document actually asks a browser for"
pw_doc index '<script src="/_next/static/chunks/one.js" async=""></script><script src="/_next/static/chunks/two.js" async=""></script>'
run_weigh "the root document is the route /"        0 '\| `/` \| 2 \|' /

pw_doc legacy '<script src="/_next/static/chunks/one.js"></script><script src="/_next/static/chunks/legacy.js" noModule=""></script>'
run_weigh "a noModule bundle is not a counted script" 0 '\| `/legacy` \| 1 \|' /legacy
run_weigh "and its bytes are not in the total"      0 '\| 1 \| \*\*[0-9]{2} KB\*\*' /legacy
run_weigh "and it is reported rather than dropped"  0 '\| \+[0-9]{3} KB \|' /legacy

pw_doc lower '<script nomodule src="/_next/static/chunks/legacy.js"></script><script src="/_next/static/chunks/one.js"></script>'
run_weigh "the attribute is read however it is spelled" 0 '\| `/lower` \| 1 \| \*\*[0-9]{2} KB\*\*' /lower

pw_doc twice '<script src="/_next/static/chunks/one.js"></script><script src="/_next/static/chunks/one.js" async=""></script>'
run_weigh "a chunk requested twice is fetched once" 0 '\| `/twice` \| 1 \|' /twice

pw_doc inline '<script src="/_next/static/chunks/one.js"></script><script>self.__next_f.push([1])</script>'
run_weigh "an inline script asks for no bytes"      0 '\| `/inline` \| 1 \|' /inline

section "Page weight: the ways it must not fail open"
# A route rendered on demand has an empty document beside the prerendered ones,
# and `0 KB` is the wrong answer about the heaviest page in the build.
pw_doc ondemand ''
run_weigh "a route rendered on demand is named, not weighed" 0 'Rendered on demand.*`/ondemand`'
run_weigh "and asked for by name it refuses"        2 "no prerendered document for /ondemand" /ondemand
run_weigh "a route this build does not have"        2 "no prerendered document for /invented" /invented

pw_doc missing '<script src="/_next/static/chunks/absent.js"></script>'
run_weigh "a chunk the build does not contain"      2 "does not contain" /missing

pw_doc offsite '<script src="https://cdn.example.test/tag.js"></script>'
run_weigh "a script served from somewhere else"     2 "not served from the build output" /offsite

run_weigh "an argument it does not know"            2 "could not run" --wat
run_weigh "a flag with no value"                    2 "could not run" --app

mkdir -p "$ROOT/page-weight-empty/.next"
run_weigh_in "a build with no prerendered documents" "$ROOT/page-weight-empty" 2 "no prerendered documents"
run_weigh_in "no build output at all" "$ROOT/page-weight-nothing" 2 "no build output"
