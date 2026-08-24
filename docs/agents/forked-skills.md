# Forked skills

Almost every skill here is **vendored**: installed by `npx skills add`, tracked in
`skills-lock.json`, and never hand-edited — `npx skills update` pulls a newer version and the local
copy is disposable. That is the default and it should stay the default.

A **fork** is a skill that started as someone else's and diverged far enough that updating it would
destroy the divergence. A fork leaves `skills-lock.json`, because the lock is an install manifest:
`skills update` pulls latest and `skills experimental_install` restores from the lock, and either
would overwrite local changes without asking.

Leaving the lock also erases where the file came from, which is what this table exists to prevent.
The upstream path and the hash it was forked at together give a future reader a real diff to look
at, rather than a vague memory that "this used to be Matt's".

| Skill     | Upstream                                                  | Forked at `computedHash`                                           | Why                                                                                   |
| --------- | --------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `to-spec` | `mattpocock/skills` `skills/engineering/to-spec/SKILL.md` | `3fa1a0695d4ea242fae9e569e4d22aa1788623197abb33bfadafae7315789bbf` | Rewritten end to end as the three-phase Design stage. Nothing of the original remains |

## Before you fork anything else

**A small diff is not a fork, it is a maintenance burden with no upside.** `to-tickets` was
de-vendored once for a 10-line change on a 119-line file, which traded every future upstream
improvement to the vertical-slice rules and the expand–contract sequencing for four additive
paragraphs. It was put back, and the coupling it was carrying moved into the spec template instead:
each non-functional requirement names the stories it binds, and `/to-tickets` picks that up through
the artifact it already reads.

That is the pattern to reach for first. **Put the coupling in an artifact you own, not in a skill
you borrowed.** A spec template is ours to change freely; a vendored skill is not.

Fork only when the divergence is structural — the procedure itself is different, not the details.
Then add a row above, in the same change.
