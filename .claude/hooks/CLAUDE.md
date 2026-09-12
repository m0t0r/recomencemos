# .claude/hooks

What to know before writing or changing a hook. The rules the gates enforce are in the root
`CLAUDE.md` under **The Build gate**; the case-level notes for every gate `gate-test.sh` drives are
imported below.

**A hook that reads repo state reads it through the payload, never through `CLAUDE_PROJECT_DIR`.**
That variable names the directory the session **launched** from and goes on naming the main checkout
inside a worktree — measured, not assumed. Two hooks read the wrong tree because of it: the stop gate
verified a clean main checkout and reported a pass having run nothing, and the Design gate judged
`/to-tickets` against the specs on the default branch. `tree_for()` in `.claude/hooks/gate-lib.sh` is
the fix and the record; use it in any new hook that touches the repository.


**These gates refuse false positives loudly, so keep them honest.** Heredoc bodies are data — a
commit message naming `gh pr merge` is prose, and `gate-lib.sh`'s `strip_heredocs` plus the
`CMD_START` anchor are what stop the gate refusing the commit that documents it. Four false refusals
were found by `gate-test.sh` while these were written; every new rule needs its prose case.

@../../scripts/CLAUDE.md
