# scripts/ and the gate suite

Case-level notes for the repository's gates and the scripts `.claude/hooks/gate-test.sh` drives. They
moved here from the root `CLAUDE.md` so they load only when you work on them; the root still says that
`pnpm test` runs these gates and that each exits `2` when it cannot reach an answer.

- **`gate-test.sh` is the runner and holds no case.** The cases live one file per thing under test in `.claude/hooks/tests/` — `hooks.sh` for rules A–J, `worktree.sh` for rule K, one file named for each script under `scripts/`, and `lint.sh` for the lint configuration that is a gate, which includes `scripts/oxlint-plugin.mjs`: that script's cases need the repository's real configs to lint through, so they sit beside the testing-library ones rather than in a file named for it — and `tests/lib.sh` holds the two assertions they are written with: `expect_decision` for a hook payload and `expect_run` for a command's exit code and output. A gate-specific runner is a one-line adapter over one of those, never its own bookkeeping; twelve copies of the same ten lines is what that rule replaced. Each file runs in its own subshell with its own fixture root. `pnpm test:gates migrations` runs one file, `-v` enumerates every case, and a name that is not a file is refused rather than skipped.
- **Four of the scripts it drives are not gates**, and the reason is worth knowing before adding more: `scripts/ui-proof.mjs` publishes recorded proof, `scripts/first-load-bytes.mjs` measures, `scripts/dev-origin.mjs` answers where this tree's dev server is, and `scripts/coverage-merge.mjs` folds six workspaces' coverage reports into the one a pull request comment is built from — none of them decides whether work may proceed. They are driven here anyway because they are repo logic living in `scripts/`, and the alternative was a second test runner for one file. Taking `ui-proof.mjs` as the worked example, fifty-five cases: most of them run `--dry-run`, which is offline by construction — no pull request, no markdown renderer, no credential — so what is under test there is the part that decides _what would be published_: the naming rule, the grouping into comparisons, and the two prefixes that carry the two lifetimes. The call that writes to the object store lives in `scripts/ui-proof-store.mjs` and is a dynamic import, so a dry run never loads it.

  **Twenty-four of the fifty-five drive the real publish, and still offline** (#165): a fake `gh` earlier on `PATH` answering the four calls the publisher makes, and a stub HTTP server as the endpoint, which records every request and can be told to answer 500. That is the only place the object-store call, the subprocesses and the body edit are exercised, and it is worth its weight because **both defects this path has shipped were invisible to every dry-run case** — a bucket asked for as a hostname, and a subprocess handed its input through an option that does not exist. What no stub can check is that the signature is _valid_; that stays §5 of `docs/runbooks/ui-proof-artifacts.md`, checked once by a human, because a container in this suite is what the Docker paragraph in the root `CLAUDE.md` refuses on the same grounds.

  **A publish runs under a deadline of its own, and the whole tree is killed at it** — `timeout(1)` is GNU coreutils and is not on a stock macOS, and `kill` reaches one process while the publisher's `gh` and the `cat` inside it are two levels down. The failure mode here is a subprocess that blocks, and a case that hangs is worse than no case: a red suite tells you something and a suite that never returns tells you nothing while costing a CI job its whole timeout. Two things follow for anyone copying the shape. A **`trap … EXIT` must be guarded on the shell that set it**, because bash 4.0 and later run it when a command substitution's subshell exits too, and this file reads exit codes out of those — unguarded, it kills the stub before the first upload, on CI and not on the macOS bash 3.2 it was written on. And the timeout is reported **as the deadline rather than as an exit code**, because a hang and a refusal are different findings.

- The **dependency audit** (`scripts/audit-direct.mjs`), thirteen cases. Five exist because the way that gate fails is by **failing open**: an unread `pnpm-workspace.yaml` would leave only the root manifest counting as direct, and a `high` in a workspace dependency would print as transitive and exit 0.
- The **dependency report** (`scripts/audit-report.mjs`), sixteen cases, over the same fixtures as the audit above — deliberately, because the two share `audit-lib.mjs` and a disagreement between them about which dependency is direct would have to show up in both sets at once. Four are the **fingerprint**, which is what stops the daily workflow either commenting every day on an unchanged finding or staying silent about a new one: the same advisories in the other order must hash alike, and a changed severity or package must not. That inequality is asserted by comparing two values rather than by a pattern, because `grep -E` is POSIX ERE and has no negative lookahead.
- **Migration integrity** (`scripts/migration-integrity.mjs`), fifty-seven cases across NFR30's four counts — an append-only journal, immutable shipped migrations, destructive statements travelling alone under a `contract` marker, and a marked migration never sharing a pull request with `@repo/domain`'s query modules. Its fixtures are real git repositories, because the gate's whole frame is `git merge-base <base branch> HEAD` and there is nothing left to mock that would still be the thing under test. Ten of the fifty-seven are a section of their own — holes `/code-review` found in the first draft, four of which passed green while checking nothing. Read them before touching the SQL scan: an escaped quote that swallowed the rest of the file, and an `ALTER TABLE` whose comma-separated actions hid a `DROP` beside an `ADD`. **`run_mig` unsets `GITHUB_BASE_REF` for every case**, and that is load-bearing: CI sets it on a `pull_request` event, the gate reads it ahead of `origin/HEAD`, and a fixture is a different repository with no such ref — thirty-five cases went red on the first CI run for exactly that.

All three exit `2` rather than `0` or `1` when they cannot reach an answer, so a broken gate cannot be read as a clean one.

**One carve-out in rule 3, added by #17 and worth reading before widening it.** A `DROP CONSTRAINT
"x"` on table `t` is not counted destructive when the same migration adds an `ADD CONSTRAINT "x"
CHECK` back **on `t`**, and an earlier migration already declared `t`.`x` a `CHECK` — so it is a
re-creation rather than a removal. DD2 makes every enum-shaped column a `TEXT` with a `CHECK`
_"precisely so that widening the set is a constraint change"_, and Postgres offers exactly one way
to widen one; before the carve-out, rule 3 refused the pair and rule 4 kept the marked migration
out of any PR touching a query module, which made every widening unsatisfiable. The gate's own
reason — _"the drop has already destroyed the data"_ — does not reach a `CHECK`.

**Both of the qualifications above are patched bypasses, not caution, and they are why this is
worth reading before touching it.** `DROP CONSTRAINT` does not say what _kind_ of constraint it
removes, so matching the re-add alone let a `UNIQUE` be dropped and a `CHECK (true)` put back under
its name — that is what the history condition closed. And a constraint name is unique **per table**
in Postgres rather than per schema, so a decoy `CREATE TABLE "decoy" (…, CONSTRAINT
"user_email_unique" CHECK (true))` in one migration used to vouch for dropping the real uniqueness in
the next — that is what keying on `table.name` closed (review of #93). It fails closed on every
axis: an unknown name, an unreadable table, an unusual spelling all refuse. It is otherwise
deliberately narrow — a bare drop, a re-add under another name, a re-add on another table, and a
re-add as `UNIQUE` all still refuse, and twenty `gate-test.sh` cases say so.

The **spec-identifier gate** (`scripts/spec-identifiers.mjs`), seventy-two cases. It is the one
gate here that has to read a language rather than a file format, and every case that is not a
citation is about that: comments are the record and are never read, so a continuation line of a
block comment and a `{/* … */}` in JSX both pass, while a closing JSX tag, an apostrophe in JSX
text and a regular expression holding a quote are three of the ways a naive reader would skip past
the strings that follow and report a clean tree. Its refusals are its own section, because a check
that cannot reach an answer must not be read as one that found nothing.

**Four of the seventy-two are `=>`, and they are the ones to read before touching the reader.**
Its rule is that an unrecognised context before a `/` reads as division, because that is the
cheaper mistake — but cheaper is not free: a real pattern read as division has its body tokenised
as code, and `/[/*]/` in an arrow function then opens a block comment that runs to the end of the
file. The gate reported that file clean, and `/code-review` found it. `<` and a bare `>` are still
absent from the set, because every closing JSX tag is `<` then `/` and every opening one ends in
`>`; `=>` is the one operator read as two characters, since no JSX `>` is preceded by an `=`.

**Shell is read by a tokeniser of its own**, because its quoting is not JavaScript's: `'…'` takes no
escapes, `$'…'` is a third quoting form, a `#` opens a comment only at a word boundary — so `$#` and
`foo#bar` are text, not comments — and a heredoc body is data at a delimiter the script names, skipped
whole the way `gate-lib.sh`'s `strip_heredocs` skips it for the neighbouring problem. A
`${MSG:-a default}` is not skipped: that word is text the shell prints, and this repo already
writes one into the middle of a refusal a person reads. `"$NFR8 holds"`
names a variable and carries no citation, exactly as `${NFR8}` does in a template literal. The walk
still skips `.agents/` and `.claude/`, and for shell that skip earns a second reason:
`gate-test.sh` drives this gate and its fixtures are the citations it refuses, so it cannot be subject
to itself — which is why that suite runs the gate over the other hooks, `build-guard.sh` included.

- `wizard` — generates a bash wizard that walks a human through steps only they can perform:
  provisioning, credentials, a third-party dashboard, a one-off cutover. `scripts/go-live.sh` and
  `scripts/ui-proof-setup.sh` (`pnpm ui-proof:setup`, the artifact store) are its two committed
  products here, and they are the shape to copy: the library above the `STAGES` marker is generated
  and never hand-edited — byte-identical in both, and a `diff` against `template.sh` is how that is
  checked — and the stages below it are authored through `/wizard`. The
  other one, `scripts/setup.sh`, was deleted with the template framing — it walked a human through
  claiming a fresh clone, which is not a procedure this repository has any more.

  **The two differ on where a captured secret goes, and the difference is the rule rather than an
  inconsistency.** `go-live.sh` writes no env file at all, because its secrets belong to a deploy and
  `fly secrets` is where a deploy reads them. `ui-proof-setup.sh` writes `apps/web/.env.local`,
  because its five values are read by a script running on one operator's own machine — which is the
  case `.env.example` already sanctions for `RESEND_API_KEY` and `GOOGLE_CLIENT_SECRET`. A wizard
  that captures a secret answers "which process reads this, and where does that process run", and
  the answer decides the destination.
