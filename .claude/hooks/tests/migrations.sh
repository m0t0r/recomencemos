# The migration-integrity gate is the second non-hook here, and for the same
# reason as the audit above: repo logic deciding whether work may proceed.
#
# Its fixtures are real git repositories rather than mocks, because the gate's
# entire frame is `git merge-base <default branch> HEAD` -- there is nothing left
# to mock that would still be the thing under test. Each fixture commits a base
# state, points refs/remotes/origin/main at it, branches, and leaves the change
# in the working tree, which is also how a developer meets this gate before
# committing anything.
MIG="$REPO/scripts/migration-integrity.mjs"

# A Drizzle journal naming the given tags in order. `when` is derived from the
# index rather than read from a clock, so a fixture reads the same on every run.
journal() {
  local idx=0 sep="" out='{"version":"7","dialect":"postgresql","entries":['
  for tag in "$@"; do
    out="$out$sep{\"idx\":$idx,\"version\":\"7\",\"when\":$((1750000000000 + idx)),\"tag\":\"$tag\",\"breakpoints\":true}"
    idx=$((idx + 1)); sep=","
  done
  printf '%s]}' "$out"
}

mig_repo() { # name -> path
  local dir="$ROOT/mig-$1"
  mkdir -p "$dir/drizzle/meta"
  git -C "$dir" init -q -b main
  git -C "$dir" symbolic-ref refs/remotes/origin/HEAD refs/remotes/origin/main
  printf '%s' "$dir"
}

mig_ship() { # dir -- freeze the current state as what the default branch holds
  git -C "$1" add -A >/dev/null 2>&1
  git -C "$1" -c user.email=t@t -c user.name=t commit -q -m base >/dev/null 2>&1
  git -C "$1" update-ref refs/remotes/origin/main HEAD
  git -C "$1" checkout -q -B ticket/1-work
}

mig_start() { # name -> a repo with 0000_init already on the default branch
  local d
  d=$(mig_repo "$1")
  printf '%s\n' 'CREATE TABLE "offer" ("id" uuid PRIMARY KEY);' > "$d/drizzle/0000_init.sql"
  journal 0000_init > "$d/drizzle/meta/_journal.json"
  mig_ship "$d"
  printf '%s' "$d"
}

mig_seeded() { # name sql -> a repo whose shipped 0000_init carries that SQL
  local d
  d=$(mig_repo "$1")
  printf '%s\n' "$2" > "$d/drizzle/0000_init.sql"
  journal 0000_init > "$d/drizzle/meta/_journal.json"
  mig_ship "$d"
  printf '%s' "$d"
}

mig_add() { # dir tag sql-line... -- add a migration on the branch
  local dir="$1" tag="$2"
  shift 2
  printf '%s\n' "$@" > "$dir/drizzle/$tag.sql"
  journal 0000_init "$tag" > "$dir/drizzle/meta/_journal.json"
}

# `@repo/domain` does not exist yet, so the gate finds it by manifest name rather
# than by a path that would go stale silently. The fixture is the same shape.
mig_domain() { # dir
  mkdir -p "$1/packages/domain/src"
  printf '%s\n' '{"name":"@repo/domain","version":"0.0.0"}' > "$1/packages/domain/package.json"
  printf '%s\n' 'export const listOffers = () => [];' > "$1/packages/domain/src/offers.ts"
  printf '%s\n' 'export const schema = {};' > "$1/packages/domain/src/schema.ts"
  printf '%s\n' 'export const canAccept = () => true;' > "$1/packages/domain/src/policy.ts"
}

# GITHUB_BASE_REF is unset for every case. CI sets it on a pull_request event, and
# the gate reads it ahead of origin/HEAD -- correctly, for the repository CI
# checked out, and disastrously for a fixture, which is a different repository
# with no such ref. Thirty-five cases went red on the first CI run for exactly
# this: ambient environment reaching a fixture that is supposed to be sealed.
# The two cases that want it set it explicitly.
run_mig() { # name expect-exit expect-grep root
  expect_run "$1" "$2" "$3" -- env -u GITHUB_BASE_REF node "$MIG" --root "$4"
}

section "Migration integrity: the journal is append-only"

D=$(mig_start append)
mig_add "$D" 0001_add_note 'ALTER TABLE "offer" ADD COLUMN "note" text;'
run_mig "an appended entry"                               0 "^Migration integrity passed" "$D"

D=$(mig_start removed)
journal > "$D/drizzle/meta/_journal.json"
run_mig "a committed entry removed"                       1 "append-only"                 "$D"

D=$(mig_start reordered)
mig_add "$D" 0001_add_note 'ALTER TABLE "offer" ADD COLUMN "note" text;'
journal 0001_add_note 0000_init > "$D/drizzle/meta/_journal.json"
run_mig "two entries swapped"                             1 "append-only"                 "$D"

D=$(mig_start retagged)
journal 0000_renamed > "$D/drizzle/meta/_journal.json"
run_mig "a committed tag rewritten"                       1 "append-only"                 "$D"

D=$(mig_start rewhen)
printf '%s\n' '{"version":"7","dialect":"postgresql","entries":[{"idx":0,"version":"7","when":1,"tag":"0000_init","breakpoints":true}]}' > "$D/drizzle/meta/_journal.json"
run_mig "a committed \`when\` rewritten"                   1 "append-only"                 "$D"

section "Migration integrity: a shipped migration is immutable"

D=$(mig_start edited)
printf '%s\n' 'CREATE TABLE "offer" ("id" uuid PRIMARY KEY, "note" text);' > "$D/drizzle/0000_init.sql"
run_mig "a shipped migration edited"                      1 "immutable"                   "$D"

D=$(mig_start deleted)
rm "$D/drizzle/0000_init.sql"
run_mig "a shipped migration deleted"                     1 "immutable"                   "$D"

# Immutability begins at the merge base. A migration this branch added is still
# the branch's to rewrite -- refusing that would make the gate unsatisfiable
# during the very session that generates the file.
D=$(mig_start reworked)
mig_add "$D" 0001_add_note 'ALTER TABLE "offer" ADD COLUMN "note" text;'
mig_add "$D" 0001_add_note 'ALTER TABLE "offer" ADD COLUMN "note" varchar(500);'
run_mig "a migration this branch added, reworked"         0 "^Migration integrity passed" "$D"

section "Migration integrity: a destructive statement travels alone"

D=$(mig_start mixed)
mig_add "$D" 0001_tidy 'ALTER TABLE "offer" ADD COLUMN "note" text;' 'ALTER TABLE "offer" DROP COLUMN "memo";'
run_mig "a drop sharing a migration with an add"          1 "travels alone"               "$D"

D=$(mig_start unmarked)
mig_add "$D" 0001_tidy 'ALTER TABLE "offer" DROP COLUMN "memo";'
run_mig "a drop alone, but the name does not say so"      1 "marker"                      "$D"

D=$(mig_start marked)
mig_add "$D" 0001_contract_drop_memo 'ALTER TABLE "offer" DROP COLUMN "memo";'
run_mig "a drop alone, in a migration named for it"       0 "^Migration integrity passed" "$D"

D=$(mig_start droptable)
mig_add "$D" 0001_contract_drop_draft 'DROP TABLE "draft";' 'ALTER TABLE "offer" DROP CONSTRAINT "offer_draft_fk";'
run_mig "two destructive statements together"             0 "^Migration integrity passed" "$D"

D=$(mig_start notnull)
mig_add "$D" 0001_tighten 'CREATE INDEX "offer_idx" ON "offer" ("id");' 'ALTER TABLE "offer" ALTER COLUMN "note" SET NOT NULL;'
run_mig "SET NOT NULL sharing a migration with an index"  1 "travels alone"               "$D"

D=$(mig_start coltype)
mig_add "$D" 0001_widen 'ALTER TABLE "offer" ALTER COLUMN "note" SET DATA TYPE varchar(500);' 'CREATE INDEX "offer_idx" ON "offer" ("id");'
run_mig "a column retype sharing a migration"             1 "travels alone"               "$D"

D=$(mig_start renamed)
mig_add "$D" 0001_contract_rename_note 'ALTER TABLE "offer" RENAME COLUMN "note" TO "terms";'
run_mig "a rename alone, marked"                          0 "^Migration integrity passed" "$D"

section "Migration integrity: a CHECK re-created under its own name is a widening"

# DD2 makes an enum-shaped column `TEXT` with a `CHECK (col IN (...))` so that
# widening the set is a constraint change — and Postgres offers exactly one way to
# widen one, which is to drop it and add it back. Before #17 that made every such
# widening unsatisfiable: rule 3 refused the pair and rule 4 kept the marked
# migration out of any PR touching a query module, which is every PR that needs the
# new member.
#
# **The carve-out reads two things, and a security review is why it reads the
# second.** The same migration must add a `CHECK` back under the dropped name, and
# an *earlier* migration must have declared that name a check. `DROP CONSTRAINT`
# does not say what kind it removes, so the first condition alone exempted dropping
# a `UNIQUE` and putting a check back under its name. The fixtures below therefore
# seed a history: `mig_seeded` ships an `0000_init` that says what the constraint
# was, which is the fact the gate is now consulting.

CHECK_HISTORY='CREATE TABLE "session" ("sign_in_method" text NOT NULL, CONSTRAINT "session_method_known" CHECK ("sign_in_method" IN ('"'a'"')));'
UNIQUE_HISTORY='CREATE TABLE "user" ("email" text NOT NULL, CONSTRAINT "user_email_unique" UNIQUE("email"));'

D=$(mig_seeded checkwiden "$CHECK_HISTORY")
mig_add "$D" 0001_admin_methods \
  'ALTER TABLE "session" DROP CONSTRAINT "session_method_known";' \
  'ALTER TABLE "user" ADD COLUMN "is_admin" boolean DEFAULT false NOT NULL;' \
  'ALTER TABLE "session" ADD CONSTRAINT "session_method_known" CHECK ("sign_in_method" IN ('"'a'"', '"'b'"'));'
run_mig "a CHECK dropped and re-added under one name"     0 "^Migration integrity passed" "$D"

# The `IF EXISTS` spelling is the one a hand-written migration reaches for, and it
# must land on the same side as the generated one.
D=$(mig_seeded checkwidenifexists "$CHECK_HISTORY")
mig_add "$D" 0001_admin_methods \
  'ALTER TABLE "session" DROP CONSTRAINT IF EXISTS "session_method_known";' \
  'ALTER TABLE "session" ADD CONSTRAINT "session_method_known" CHECK ("sign_in_method" IN ('"'a'"'));'
run_mig "a CHECK re-added after DROP CONSTRAINT IF EXISTS" 0 "^Migration integrity passed" "$D"

# **The case the security review found.** The name was a `UNIQUE`, and putting a
# check back under it is the removal of a uniqueness guarantee wearing the shape of
# a widening — on `user.email` that is what stops one person holding two Accounts
# by capitalising. It must refuse, and it must refuse because the history says the
# name was never a check.
D=$(mig_seeded uniquedroppedaschecked "$UNIQUE_HISTORY")
mig_add "$D" 0001_swap \
  'ALTER TABLE "user" DROP CONSTRAINT "user_email_unique";' \
  'ALTER TABLE "user" ADD CONSTRAINT "user_email_unique" CHECK (true);'
run_mig "a UNIQUE dropped and re-added as a CHECK"        1 "travels alone"               "$D"

# A name no migration has ever declared at all is the same answer for the same
# reason — the gate fails closed rather than assuming.
D=$(mig_seeded checkunknownname "$CHECK_HISTORY")
mig_add "$D" 0001_swap \
  'ALTER TABLE "session" DROP CONSTRAINT "session_never_declared";' \
  'ALTER TABLE "session" ADD CONSTRAINT "session_never_declared" CHECK (true);'
run_mig "a drop of a name the history never declared"     1 "travels alone"               "$D"

# The three cases the carve-out must decline even with a genuine check history,
# because each is a different act than widening a predicate.

D=$(mig_seeded checkdroponly "$CHECK_HISTORY")
mig_add "$D" 0001_loosen \
  'ALTER TABLE "session" DROP CONSTRAINT "session_method_known";' \
  'ALTER TABLE "user" ADD COLUMN "is_admin" boolean DEFAULT false NOT NULL;'
run_mig "a CHECK dropped and never added back"            1 "travels alone"               "$D"

D=$(mig_seeded checkothername "$CHECK_HISTORY")
mig_add "$D" 0001_swap \
  'ALTER TABLE "session" DROP CONSTRAINT "session_method_known";' \
  'ALTER TABLE "session" ADD CONSTRAINT "session_other_known" CHECK ("sign_in_method" IN ('"'a'"'));'
run_mig "a different constraint added in its place"       1 "travels alone"               "$D"

# Re-adding as UNIQUE is not the same act: the drop takes an index with it, and a
# narrower unique can fail against rows that already exist.
D=$(mig_seeded checkreaddunique "$CHECK_HISTORY")
mig_add "$D" 0001_swap \
  'ALTER TABLE "session" DROP CONSTRAINT "session_method_known";' \
  'ALTER TABLE "session" ADD CONSTRAINT "session_method_known" UNIQUE ("sign_in_method");'
run_mig "a constraint re-added as UNIQUE, not CHECK"      1 "travels alone"               "$D"

# **The same bypass wearing a second table**, found reviewing #93. A constraint
# name is unique per *table* in Postgres, not per schema, and a `CHECK` creates no
# index to collide with the `UNIQUE` of the same name — so a decoy table declaring
# `user_email_unique` as a check is legal SQL, and it used to teach the history
# scan that the name was a predicate. The migration after it then dropped the real
# uniqueness on `"user"` and put a `CHECK (true)` back, and both of the carve-out's
# conditions passed. Two migrations rather than one, because a migration may not
# vouch for itself — that hole was closed first, and this is the way round it.
D=$(mig_seeded checkdecoytable "$UNIQUE_HISTORY")
printf '%s\n' 'CREATE TABLE "decoy" ("x" integer, CONSTRAINT "user_email_unique" CHECK (true));' \
  > "$D/drizzle/0001_decoy.sql"
printf '%s\n' \
  'ALTER TABLE "user" DROP CONSTRAINT "user_email_unique";' \
  'ALTER TABLE "user" ADD CONSTRAINT "user_email_unique" CHECK (true);' \
  > "$D/drizzle/0002_swap.sql"
journal 0000_init 0001_decoy 0002_swap > "$D/drizzle/meta/_journal.json"
run_mig "a decoy CHECK of that name on another table"     1 "travels alone"               "$D"

# The table is read on the re-add side too: putting the check back somewhere else
# is not re-creating the one that was dropped.
D=$(mig_seeded checkreaddothertable "$CHECK_HISTORY")
mig_add "$D" 0001_swap \
  'ALTER TABLE "session" DROP CONSTRAINT "session_method_known";' \
  'ALTER TABLE "decoy" ADD CONSTRAINT "session_method_known" CHECK (true);'
run_mig "a CHECK re-added on a different table"           1 "travels alone"               "$D"

# One `ALTER TABLE` carrying both actions past a comma, which is the spelling that
# loses its table to `actions` — the pair must still read as a widening, and this
# is the case that fails if the table is not threaded through the split.
D=$(mig_seeded checkwidenoneline "$CHECK_HISTORY")
mig_add "$D" 0001_admin_methods \
  'ALTER TABLE "session" DROP CONSTRAINT "session_method_known", ADD CONSTRAINT "session_method_known" CHECK ("sign_in_method" IN ('"'a'"', '"'b'"'));'
run_mig "a CHECK widened by one multi-action ALTER TABLE" 0 "^Migration integrity passed" "$D"

# The carve-out reaches one statement kind and no other: a DROP COLUMN beside a
# genuine CHECK widening is still a mixture, and still the thing rule 3 is for.
D=$(mig_seeded checkwidenplusdrop "$CHECK_HISTORY")
mig_add "$D" 0001_both \
  'ALTER TABLE "session" DROP CONSTRAINT "session_method_known";' \
  'ALTER TABLE "session" ADD CONSTRAINT "session_method_known" CHECK ("sign_in_method" IN ('"'a'"'));' \
  'ALTER TABLE "offer" DROP COLUMN "memo";'
run_mig "a DROP COLUMN beside a CHECK widening"           1 "travels alone"               "$D"

# The prose cases. Every one of these is text that names a destructive statement
# without being one, and four false refusals were found the last time these rules
# were written.
D=$(mig_start prose_comment)
mig_add "$D" 0001_add_note '-- supersedes the DROP COLUMN "memo" this replaces' 'ALTER TABLE "offer" ADD COLUMN "note" text;'
run_mig "DROP COLUMN inside a SQL line comment"           0 "^Migration integrity passed" "$D"

D=$(mig_start prose_block)
mig_add "$D" 0001_add_note '/* DROP TABLE "draft" is the contract half, next release */' 'ALTER TABLE "offer" ADD COLUMN "note" text;'
run_mig "DROP TABLE inside a SQL block comment"           0 "^Migration integrity passed" "$D"

D=$(mig_start prose_literal)
mig_add "$D" 0001_seed_skill "INSERT INTO \"skill\" (\"label_es\") VALUES ('DROP TABLE y RENAME');"
run_mig "a destructive phrase inside a string literal"    0 "^Migration integrity passed" "$D"

D=$(mig_start addconstraint)
mig_add "$D" 0001_add_fk 'ALTER TABLE "offer" ADD CONSTRAINT "offer_hirer_fk" FOREIGN KEY ("hirer_id") REFERENCES "account"("id");'
run_mig "ADD CONSTRAINT is not DROP CONSTRAINT"           0 "^Migration integrity passed" "$D"

D=$(mig_start addnotnull)
mig_add "$D" 0001_add_note 'ALTER TABLE "offer" ADD COLUMN "note" text NOT NULL DEFAULT '"''"';'
run_mig "ADD COLUMN ... NOT NULL is not SET NOT NULL"     0 "^Migration integrity passed" "$D"

D=$(mig_start createtype)
mig_add "$D" 0001_add_status 'CREATE TYPE "offer_status" AS ENUM('"'draft'"', '"'sent'"');' 'ALTER TABLE "offer" ADD COLUMN "status" "offer_status";'
run_mig "CREATE TYPE is not ALTER COLUMN ... TYPE"        0 "^Migration integrity passed" "$D"

# A quoted identifier now leaves its *name* in the scanned text rather than a bare
# `ident`, so that rule 3's CHECK carve-out can pair a drop with its re-add. These
# three are what say the erasure still does its original job: a name cannot become
# a destructive phrase, whether it is plain, punctuated, or quote-escaped.
D=$(mig_start identunderscore)
mig_add "$D" 0001_add_flag 'ALTER TABLE "offer" ADD COLUMN "drop_table" boolean;'
run_mig "a column whose name is drop_table"               0 "^Migration integrity passed" "$D"

D=$(mig_start identspace)
mig_add "$D" 0001_add_flag 'ALTER TABLE "offer" ADD COLUMN "drop table" boolean;'
run_mig "a column whose quoted name holds a space"        0 "^Migration integrity passed" "$D"

D=$(mig_start identrename)
mig_add "$D" 0001_add_flag 'ALTER TABLE "offer" ADD COLUMN "rename" boolean;'
run_mig "a column named for a destructive keyword"        0 "^Migration integrity passed" "$D"

section "Migration integrity: contract and code ship separately"

D=$(mig_start contract_code)
mig_domain "$D"
mig_ship "$D"
mig_add "$D" 0001_contract_drop_memo 'ALTER TABLE "offer" DROP COLUMN "memo";'
printf '%s\n' 'export const listOffers = () => [1];' > "$D/packages/domain/src/offers.ts"
run_mig "a contract migration beside a query module"      1 "ship separately"             "$D"

# The schema is what a contract migration is generated *from*, so it has to be
# allowed to move with it or the rule refuses the only way to satisfy itself.
D=$(mig_start contract_schema)
mig_domain "$D"
mig_ship "$D"
mig_add "$D" 0001_contract_drop_memo 'ALTER TABLE "offer" DROP COLUMN "memo";'
printf '%s\n' 'export const schema = { offer: {} };' > "$D/packages/domain/src/schema.ts"
run_mig "a contract migration beside the schema"          0 "^Migration integrity passed" "$D"

D=$(mig_start contract_pure)
mig_domain "$D"
mig_ship "$D"
mig_add "$D" 0001_contract_drop_memo 'ALTER TABLE "offer" DROP COLUMN "memo";'
printf '%s\n' 'export const canAccept = () => false;' > "$D/packages/domain/src/policy.ts"
run_mig "a contract migration beside a pure module"       0 "^Migration integrity passed" "$D"

D=$(mig_start additive_code)
mig_domain "$D"
mig_ship "$D"
mig_add "$D" 0001_add_note 'ALTER TABLE "offer" ADD COLUMN "note" text;'
printf '%s\n' 'export const listOffers = () => [1];' > "$D/packages/domain/src/offers.ts"
run_mig "an additive migration beside a query module"     0 "^Migration integrity passed" "$D"

D=$(mig_start contract_adr)
mig_domain "$D"
mig_ship "$D"
mig_add "$D" 0001_contract_drop_memo 'ALTER TABLE "offer" DROP COLUMN "memo";'
mkdir -p "$D/docs/adr"
printf '%s\n' '# ADR-0013' 'DROP TABLE, DROP COLUMN, DROP CONSTRAINT, ALTER COLUMN ... TYPE and any RENAME.' > "$D/docs/adr/0013-x.md"
run_mig "a contract migration beside an ADR quoting it"   0 "^Migration integrity passed" "$D"

# Every case below is a hole /code-review found in the first draft of this gate.
# Four of them passed green while checking nothing, which is the one way a
# guardrail is worse than no guardrail at all.
section "Migration integrity: the holes review found"

# A backslash-escaped quote inside an E-string left the quote count odd, and the
# scan then swallowed the rest of the file -- so every statement after it went
# unread. Postgres ships standard_conforming_strings on, so `\` escapes in
# `E'...'` and nowhere else; both halves need their case.
D=$(mig_start estring)
mig_add "$D" 0001_tidy "ALTER TABLE \"o\" ADD COLUMN \"c\" text DEFAULT E'it\\'s';" 'DROP TABLE "z";'
run_mig "a DROP after an escaped quote in an E-string"    1 "travels alone"               "$D"

D=$(mig_start plainquote)
mig_add "$D" 0001_seed "INSERT INTO \"skill\" VALUES ('a backslash \\\\ is literal here');" 'DROP TABLE "z";'
run_mig "a DROP after a backslash in a plain string"      1 "travels alone"               "$D"

# One ALTER TABLE carries as many comma-separated actions as it likes, so the
# statement was the wrong unit: this is exactly the mixture rule 3 exists to
# refuse, and it passed because `additive.length` was 0.
D=$(mig_start commaactions)
mig_add "$D" 0001_contract_tidy 'ALTER TABLE "offer" ADD COLUMN "a" text, DROP COLUMN "b";'
run_mig "ADD and DROP as two actions of one ALTER"        1 "travels alone"               "$D"

# ...but splitting a list is not the same as splitting actions. `DROP TABLE a, b`
# is one action over two names, and reading `b` as additive would refuse a
# migration that is wholly destructive.
D=$(mig_start droplist)
mig_add "$D" 0001_contract_drop_both 'DROP TABLE "draft", "memo";'
run_mig "DROP TABLE over a list of two names"             0 "^Migration integrity passed" "$D"

D=$(mig_start altercols)
mig_add "$D" 0001_contract_drop_two 'ALTER TABLE "offer" DROP COLUMN "a", DROP COLUMN "b";'
run_mig "two DROP COLUMN actions in one ALTER"            0 "^Migration integrity passed" "$D"

D=$(mig_start parencomma)
mig_add "$D" 0001_widen 'ALTER TABLE "offer" ADD COLUMN "amount" numeric(12, 2);'
run_mig "a comma inside a type's parentheses"             0 "^Migration integrity passed" "$D"

# Rule 3 used to check every journal entry rather than only the new ones, which
# deadlocks the repository: a mixed migration that reached the default branch
# would refuse every later pull request, while rule 2 forbids editing the file
# that would fix it. NFR30's second half rules that out.
D=$(mig_repo shipped_mixed)
printf '%s\n' 'ALTER TABLE "offer" ADD COLUMN "note" text;' 'ALTER TABLE "offer" DROP COLUMN "memo";' > "$D/drizzle/0000_tidy.sql"
journal 0000_tidy > "$D/drizzle/meta/_journal.json"
mig_ship "$D"
printf '%s\n' 'export const unrelated = 1;' > "$D/unrelated.ts"
run_mig "a mixed migration already on the default branch" 0 "^Migration integrity passed" "$D"

# A stack is the correct expand/contract split, not a violation of it: the
# contract migration is PR N and the query-module change is PR N+1. Measured
# against the default branch both land in one diff, so the gate reads the PR's
# own base branch where CI names it.
D=$(mig_start stacked)
mig_domain "$D"
mig_ship "$D"
mig_add "$D" 0001_contract_drop_memo 'ALTER TABLE "offer" DROP COLUMN "memo";'
git -C "$D" add -A >/dev/null 2>&1
git -C "$D" -c user.email=t@t -c user.name=t commit -q -m "contract" >/dev/null 2>&1
git -C "$D" update-ref refs/remotes/origin/ticket-1 HEAD
git -C "$D" checkout -q -b ticket/2-stop-using-it
printf '%s\n' 'export const listOffers = () => [1];' > "$D/packages/domain/src/offers.ts"
run_mig "the query change stacked above the contract PR"  1 "ship separately"             "$D"
expect_run "the same stack, measured against its own base" 0 "^Migration integrity passed" \
  -- env GITHUB_BASE_REF=ticket-1 node "$MIG" --root "$D"

# A manifest at the repository root made the prefix "./src/", which matches no
# path git ever prints -- rule 4 became a silent no-op rather than an answer.
D=$(mig_start rootdomain)
mkdir -p "$D/src"
printf '%s\n' '{"name":"@repo/domain","version":"0.0.0"}' > "$D/package.json"
printf '%s\n' 'export const listOffers = () => [];' > "$D/src/offers.ts"
mig_ship "$D"
mig_add "$D" 0001_contract_drop_memo 'ALTER TABLE "offer" DROP COLUMN "memo";'
printf '%s\n' 'export const listOffers = () => [1];' > "$D/src/offers.ts"
run_mig "@repo/domain declared at the repository root"    1 "ship separately"             "$D"

section "Migration integrity: the ways it must not fail open"

D=$(mig_repo none)
rm -rf "$D/drizzle"
printf '%s\n' '{"name":"root"}' > "$D/package.json"
mig_ship "$D"
run_mig "a repository with no migrations at all"          0 "no migrations"               "$D"

D=$(mig_start notjson)
printf '%s\n' 'entries: []' > "$D/drizzle/meta/_journal.json"
run_mig "a journal that is not JSON"                      2 "could not run"               "$D"

D=$(mig_start noentries)
printf '%s\n' '{"version":"7","dialect":"postgresql"}' > "$D/drizzle/meta/_journal.json"
run_mig "a journal with no entries array"                 2 "could not run"               "$D"

D=$(mig_start nofile)
mig_add "$D" 0001_add_note 'ALTER TABLE "offer" ADD COLUMN "note" text;'
rm "$D/drizzle/0001_add_note.sql"
run_mig "a journal entry with no .sql beside it"          2 "could not run"               "$D"

# GITHUB_BASE_REF naming a ref this repository does not have is the shape of the
# bug that turned 35 of these cases red on the first CI run. It must read as
# "could not run" and never as a pass -- an unresolvable base compared nothing.
D=$(mig_start badbaseref)
mig_add "$D" 0001_add_note 'ALTER TABLE "offer" ADD COLUMN "note" text;'
expect_run "GITHUB_BASE_REF naming a ref that is not there" 2 "could not run" \
  -- env GITHUB_BASE_REF=no-such-branch node "$MIG" --root "$D"

# The shape CI actually checks out, and the one no case here had: `actions/checkout`
# writes no `refs/remotes/origin/HEAD`, and on a `push` event GitHub sets no
# GITHUB_BASE_REF either -- so the gate has no default branch to measure against
# and must say so. Every fixture above is handed one by `mig_repo`, which is why
# this went uncaught until the run on `dev` went red the day the first migration
# landed. `ci.yml`'s `git remote set-head origin --auto` is the answer to it; this
# case is what says the refusal it answers is the correct one.
D=$(mig_start nodefaultbranch)
mig_add "$D" 0001_add_note 'ALTER TABLE "offer" ADD COLUMN "note" text;'
git -C "$D" symbolic-ref -d refs/remotes/origin/HEAD
run_mig "no origin/HEAD and no GITHUB_BASE_REF"           2 "could not run"               "$D"

# A shallow clone has no merge base, and that is the failure this gate must not
# report as a pass: nothing was compared, so nothing was checked.
D=$(mig_start nobase)
git -C "$D" checkout -q --orphan unrelated
git -C "$D" -c user.email=t@t -c user.name=t commit -q -m unrelated >/dev/null 2>&1
run_mig "no merge base with the default branch"           2 "could not run"               "$D"

# The run against *this* repository is deliberately not here. This suite is
# cached on `.claude/hooks/**` plus the two scripts, and the gate's answer also
# depends on git history and on migrations none of those inputs cover -- so a
# cached replay would report a pass nothing had checked. It runs uncached as the
# `//#migrations:check` task instead, inside the same `pnpm test`.


