# --- Whether production will open a pasted connection string ----------------
#
# `database-url-form.mjs` is what `go-live.sh` asks before it stages either
# database secret on Fly. It is not a gate either, and it is driven here for the
# reason `dev-origin.mjs` is: repo logic living in `scripts/`.
#
# The rule itself is `@repo/domain`'s config module, and its seam-1 cases own
# it. What these cases own is the script's contract with the wizard: the string
# arrives on stdin, the exit code is the whole answer, and a refusal never
# prints the string it refused -- which carries a password, and would otherwise
# land on the operator's screen beside a prompt that promised it was hidden.
FORM="$REPO/scripts/database-url-form.mjs"
FORM_PASSWORD="wizard-case-password"
FORM_BASE="postgresql://app:$FORM_PASSWORD@db.example:6432/app"

form() { # variable value
  printf '%s' "$2" | node "$FORM" "$1"
}

# The operator's own shell is a developer's shell. The question the wizard asks
# is about the Fly machine, so what that shell says must not relax it.
form_in_development() { # variable value
  printf '%s' "$2" | ENVIRONMENT=development node "$FORM" "$1"
}

# `expect_run` asserts what a stream matches, not what it lacks.
expect_unprinted() { # name variable value
  local out
  out=$(form "$2" "$3" 2>&1)
  if grep -qF -- "$FORM_PASSWORD" <<<"$out"; then
    ko "$1" "the password was printed" "$out"
  else
    ok "$1" "absent"
  fi
}

section "database-url-form.mjs: what go-live.sh stages"

expect_run "verify-full passes for the pooled string" 0 EMPTY EMPTY -- \
  form DATABASE_URL "$FORM_BASE?sslmode=verify-full"
expect_run "verify-full passes for the direct string" 0 EMPTY EMPTY -- \
  form DIRECT_DATABASE_URL "$FORM_BASE?sslmode=verify-full"

expect_run "no sslmode is refused, naming the variable and the form" 1 EMPTY \
  'DATABASE_URL.*sslmode=verify-full' -- form DATABASE_URL "$FORM_BASE"
expect_run "sslmode=require is refused" 1 EMPTY 'DIRECT_DATABASE_URL' -- \
  form DIRECT_DATABASE_URL "$FORM_BASE?sslmode=require"
expect_run "sslrootcert=system is refused" 1 EMPTY 'sslrootcert=system' -- \
  form DATABASE_URL "$FORM_BASE?sslmode=verify-full&sslrootcert=system"
expect_run "an empty paste is refused rather than staged" 1 EMPTY 'DATABASE_URL' -- \
  form DATABASE_URL ""
expect_run "a development shell does not relax the check" 1 EMPTY 'sslmode=verify-full' -- \
  form_in_development DATABASE_URL "$FORM_BASE"

expect_unprinted "a refused sslmode prints no part of the string" \
  DATABASE_URL "$FORM_BASE?sslmode=no-verify"
expect_unprinted "a refused sslrootcert prints no part of the string" \
  DIRECT_DATABASE_URL "$FORM_BASE?sslmode=verify-full&sslrootcert=system"
expect_unprinted "a value that is not a URL prints no part of it" \
  DATABASE_URL "host=db password=$FORM_PASSWORD sslmode=verify-full"

expect_run "a variable that is not a connection string has no answer" 2 EMPTY \
  'RESEND_API_KEY' -- form RESEND_API_KEY "$FORM_BASE?sslmode=verify-full"
expect_run "no variable at all has no answer" 2 EMPTY 'DATABASE_URL' -- \
  form "" "$FORM_BASE?sslmode=verify-full"
