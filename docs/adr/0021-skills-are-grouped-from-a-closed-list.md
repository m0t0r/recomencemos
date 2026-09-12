---
status: proposed
---

# Skills are grouped, from a closed list, and the group is chosen at promotion

[#273](https://github.com/m0t0r/recomencemos/issues/273) put the owner's choice for `/profiles` on a
wide screen — the UX lab's variant B, _El índice_ — in front of a Build session: the Skill groups down
the left, each with its count, and one tap narrows the list to that page. The product had no Skill
groups. A `Skill` was a slug, a Spanish label, a CUOC code and an `active` flag; the groups in the lab
were written into its mock, and `CONTEXT.md` lists _category_ under Skill's _Avoid_.

So the index needed a concept, and a concept in the domain binds more than the screen that asked for
it: a column every Skill carries, a migration that fills it, and a duty at the one place the
vocabulary grows. The session stopped and put that to the owner rather than deciding it inside a UI
ticket, and the answer was to land it on its own, first, with #273 stacked on it.

## The decision

**Every Skill belongs to exactly one SkillGroup, from a closed list of thirteen held in code.**
`SKILL_GROUPS` in `@repo/domain/policy` is shaped exactly like `CITIES`: an underscored English
identifier and the Spanish label a person reads (ADR-0012), with the column stored as `TEXT` + `CHECK`
generated from the list through `inList`. Adding a group is a constraint change and a reviewed
migration — never a form.

**Twelve of them are the seed's own headings**, unchanged. `0008_seed_skill_vocabulary.sql` was always
sorted under twelve comments "for the person maintaining this file", so the grouping was already an
editorial decision somebody had made about these ninety-one entries; making it data changed none of
it. The backfill was derived from those headings by reading the file rather than by retyping ninety-one
slugs.

**The thirteenth is `other` — _Otros trabajos_ — and it exists for two reasons.** An Admin promoting
what a Worker asked for may meet work that fits none of the twelve, and "put it somewhere wrong" is
the only alternative a closed list otherwise offers. And a database that has seen promotions holds
entries no heading covers, so the backfill needs somewhere honest to put them before the column can be
`NOT NULL`.

**The group is chosen by an Admin at promotion, and it is required there.** A Skill with no group is a
Skill the index cannot reach, which is a Worker the index cannot reach. The Worker never picks one —
she picks Skills, and the group is how a Hirer arrives at them.

## Consequences

- **Expand now, contract after the deploy.** A generated migration adds the column nullable, an
  authored one fills it, and a generated one adds the `CHECK` to a column that already satisfies it.
  `NOT NULL` is the contract half, and the migration gate keeps a contract out of any pull request
  that also changes a query module — which this one does, because promotion now writes the column.
  So it ships on its own once this is deployed. In between, nothing can write a `NULL`: the one
  insert path requires a group, and the backfill left none behind.
- **The Admin's promotion form gains one required choice.** It is a `<select>` over the thirteen,
  because the list is closed and short.
- **What the group does not do.** It is not shown on a profile or a row, it changes no ordering, and it
  is not a second way of describing a person: a Worker is still described by the Skills she chose, in
  her own words above them. The group is a way into the list, and only that.
- **Regrouping an entry is a migration today.** No form moves a Skill between groups, for the same
  reason no form retires one; if Admins need to, that is a new action with its own audit row, and it is
  not assumed here.
