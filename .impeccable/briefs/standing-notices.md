# Surface brief: the standing notices

**Targets:** `apps/web/app/_components/notices/`, rendered on `apps/web/app/(site)/page.tsx`,
`apps/web/app/(site)/profiles/page.tsx` and `apps/web/app/(site)/my-profile/page.tsx` · **Mode:**
Operate · **Ticket:** [#22](https://github.com/m0t0r/recomencemos/issues/22) · **Shaped:**
2026-09-08 · **Locked:** 2026-09-08 — **the disclosure treatment on the two lists, the expanded one
on `/my-profile`**; see "The decision, taken visually" below · **Amended:** 2026-09-12 with
[#276](https://github.com/m0t0r/recomencemos/issues/276) — **at the foot of the page on every
surface**; see "Amended: the foot of the page" at the end

**Shaped without an interview, by the same decision `wall.md` records.** The composition question
was about to be put as a menu and the standing answer is _"I prefer seeing /prototype and decided
visually"_. So the one genuinely open decision below was marked `[open]` and built three ways on the
real routes, against the 604 published profiles in the local database; everything else is `[settled]`
— by [`voice.md`](../../docs/policy/voice.md), by `DESIGN.md`, by `CONTEXT.md` or by the spec, each
named where it is used.

**The variants were switched by the component's own default rather than by `?variant=`**, which is
where this departs from `wall.md`'s method and is worth saying so nobody looks for a query parameter
that was never there. `/` takes no `searchParams` today, and adding some to carry a prototype would
have made the Wall dynamic on a value the shipped page does not read — churn in the route the
prototype existed to protect. Three captures, one literal edited between them, same session, same
browser.

**This is not a screen. It is a component with a slot on three screens**, which is why the brief is
named for the component rather than for a route. That is a departure from the other nine briefs here
and it is deliberate: the thing being shaped is a piece of copy that has to survive being repeated,
and repetition is the design problem.

## Job and audience

**Everyone, on every read surface, including the two people this product never introduces to each
other.** A Hirer with no account, scanning the Wall. A Worker on a phone deciding whether to publish.
A Worker on `/my-profile` looking at what she has already given us. And — the audience the tone
matrix names explicitly for this copy — a journalist.

They are deciding different things, but they are all relying on the same three facts, and the
failure this surface exists to prevent is identical for each of them: **relying on a protection that
does not exist.**

## Outcome and proof

**The primary thing each of them must understand**, in the order the copy states it:

1. **Nobody here is verified.** Not that she lost work, not that he is who he says. And — the clause
   [C4](../../docs/efforts/0002-profile-to-contact-exchange/spec.md) added and this ticket's third
   acceptance criterion names — **a Hirer's own name and phone are self-asserted like everyone
   else's**.
2. **The platform holds no money.** No commission, no balance, no escrow. And the uncomfortable
   half [ADR-0007](../../docs/adr/0007-the-platform-never-handles-money.md) refuses to soften: if she
   is not paid, we can recover nothing.
3. **A Block stops him sending, and reaches nothing else.** Her card stays on the Wall; his reading
   of her profile stays open.

**Success:** a reader who has met this component once can state what the platform does not do. Not
"feels reassured" — the opposite. The tone matrix's own row for this copy is Warmth 5→3, Directness
5 unchanged, and the note says why: _"the absence leads; warmth here reads as softening."_

**Product-specific truth, and it is the whole argument.** Every neighbouring product in this category
publishes a trust badge. This one publishes the absence of one, on every page that introduces
anybody — at its foot since #276, where a reader who came to look reaches the people first — in
its own voice, and puts the third statement — the one that costs a Worker something to learn — in the
same block as the two that cost her nothing.

## The third statement is the design problem

The ticket says so outright: _"Three statements, not two, and the third is the one most easily
lost."_ Two things conspire to lose it.

**It is the only one that needs a definition before it can be read.** A reader who has never received
an Offer does not know what a Block is, and [`voice.md`](../../docs/policy/voice.md) bans a sentence
only somebody who already knows the product can parse. So the copy defines a Block in the same breath
as it bounds one, and that is why statement three is a sentence longer than the other two rather than
a clause appended to statement one.

**And its natural home does not exist yet.** No Offer surface is built. Deferring it to the surfaces
where a Block is offered would be deferring it to a later ticket, which is exactly how the ticket
predicts it gets lost. So all three statements render on every listed surface, and statement three is
written to stand alone.

## Selected direction

**Structural thesis `[settled]`:** one component, one copy module, three statements, on every surface
that carries it. Not a per-surface subset. A half-version is the failure mode
[`list-copy.ts`](../../apps/web/testing/list-copy.ts) already guards the two lists against, and the
reason it gives is the one that governs here: _"a half-version on a list would give them a second
source — which is the one thing worse than an absent notice."_

_This originally read "rendered identically on every surface", and the lock below made that half
false: there are two treatments. What survived is the half the sentence was protecting — the same
three statements, in the same order, word for word, from one module. The density varies; the content
does not._

**Not the registry's `Alert` `[settled]`, and it is a semantic choice rather than a visual one.**
`Alert` carries `role="alert"`, which interrupts whatever is being read. These are standing facts,
true on every page, every time — a live region that fires on arrival at every route is a warning
nobody trusts twice. `app/(admin)/admin/_components/shell-notices.tsx` already made this call for the
publish-rate signal and wrote down the reasoning; this is the same call for the same reason. A
`<section>` with an accessible name, `<h2>`/`<h3>` per statement, no live region.

**A mark, never a hue `[settled]`.** `DESIGN.md` → The world: _"State is a mark, never a hue."_ Each
statement carries a `lucide` mark, `aria-hidden`, and the mark is redundant with a heading that says
the same thing in words — which is also how the WCAG 2.2 AA criterion in this ticket ("not conveyed
by colour alone") is met rather than argued. Nothing here is `destructive`: `DESIGN.md` reserves that
triad for a limit of the platform, and while these _are_ limits of the platform, painting three of
them red on the first screen of the Wall would make the product look like a warning label. The ink is
the ink.

**Server Component, no client JavaScript `[settled]`.** Criterion 6 asks for readable without
JavaScript and inside NFR3's byte budget rather than exempt from it. A component that ships no client
bundle satisfies both structurally instead of by measurement — and where a variant needs disclosure,
it uses `<details>`, which is native HTML and works with the script tag removed.

**Placement `[settled]`, and overturned by #276** — the paragraph below is the 2026-09-08 answer,
kept because its argument about the boundary still holds; the position it argues for does not. See
"Amended: the foot of the page" at the end.

On the Wall and on `/profiles`, in the slot both pages already reserve with
a comment: below the `<h2>`, above the list, and **outside `ListBoundary`**. Outside is not a detail —
the spec's Wall `error` cell asks for _"the notices still render"_ when the read fails, and outside
the boundary is the only place that is true. It is also the structural answer to this ticket's fifth
criterion: notices above and outside the boundary cannot be moved by a grid that shifts below them.

On `/my-profile` they go at the foot of the three visibility regions, after _Lo que ve solo quien tú
aceptes_ — the page is already an honest account of who sees what, and these three are the same
account continued: who checked (nobody), what we hold (no money), and what refusing someone reaches.

## The decision that is open

**How much of the first viewport three statements may take on a 390 px phone `[open]`.**

This is the one criterion 4 hands to `shape`, and it is genuinely a looking question rather than a
reasoning one. The tension is real in both directions and neither side wins on argument:

- Fully expanded, the three statements are roughly 400 px on a phone. Above the Wall's list that
  pushes the first profile row below the fold — and the Wall's whole job, per `wall.md`, is that _"he
  reads three or four cards and forms a view"_.
- Compressed, the honesty surface becomes a line of small print, which is the shape every product
  that is hiding something uses. "Prominently" is the criterion's own word.

Three variants go to `/prototype` as `?variant=` on `/` and `/profiles`:

| Variant | What it is                                                                                                                                   |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **A**   | All three open, separated by the ruling, no container. The notebook's own device, quietest, tallest                                          |
| **B**   | All three open inside one bordered panel. Reads as a distinct object on the page; still tall                                                 |
| **C**   | Each statement's **absence sentence** always visible, the elaboration behind a native `<details>`. Compact, and nothing that leads is hidden |

**What is not a variant, because it is not open:** the copy, the order of the three statements, the
absence-leads rule, the heading levels, or whether statement three appears at all. A variant that
cut a statement to fit would be answering a different question.

**The reader picks. This session builds all three, captures them at 390 × 844 light, and stops.**

## The decision, taken visually

All three went to the real `/` at 390 × 844 against 604 published profiles. The answer is **none of
them as posed**, and the reason the split is the right answer is visible in the captures rather than
arguable from the description:

| Was open                                              | Answer                                                                                                                         |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Prominence above a list** (`/`, `/profiles`)        | **Disclosure.** The three absences are always on screen; the elaboration is one tap away, and the first profile row survives   |
| **Prominence where nothing competes** (`/my-profile`) | **Expanded.** All three read in full, separated by the ruling                                                                  |
| **The bordered panel**                                | **Dropped.** It was the tallest of the three and the only one painting a box, which `DESIGN.md`'s ruled-page rule does not use |

**The split is a real cost and it is accepted rather than unnoticed.** The brief above argues for one
component rendered identically everywhere, and this is one component rendered two ways. What it keeps
is the part that argument was actually protecting: **one copy module, one source, three statements,
never a subset.** Both treatments render all three, in the same order, word for word, from
`app/_lib/notices/messages.ts`, and `notice-surfaces.test.ts` is what stops a third presentation
arriving. What varies is whether the second paragraph of each is on screen or one tap away, which is
a density decision and not a content one.

**The treatment prop is required, with no default**, so that the next surface takes this decision
rather than inheriting it. The rule for taking it is in the type's own doc comment: disclosure where
the notices sit next to content the reader came for (above it until #276, below it since), expanded
where they do not.

### What `/code-review` then changed, and it is the important part

The split above was locked, built, and reviewed — and the Spec axis found that it had quietly moved
two acceptance criteria behind a tap. In the first cut a statement was a heading plus a body, and the
**whole** body went inside the `<details>`. So on `/` and `/profiles` — the only surfaces an
anonymous Hirer meets — the clause naming his own name and phone as self-asserted (criterion 3) and
the clause saying a Block does **not** remove her from the Wall (criterion 2's third statement, the
one the ticket calls _"the one most easily lost"_) were both collapsed by default.

The prominence decision was not the thing that was wrong; the copy model was. Each statement now
carries three parts rather than two:

- **`heading`** — the absence, stated whole.
- **`lead`** — one sentence, **always on screen in both treatments**: what this absence costs the
  reader. Every clause an acceptance criterion names by hand lives here.
- **`detail`** — what we do instead, and how the thing works. The only part a tap reveals.

**The rule that falls out of it is the one to keep:** a treatment decides how much _explanation_ is
in front of a reader before they ask for it, and it may never decide what the product says. A
criterion is never the thing a disclosure hides. `standing-notices.test.tsx` asserts each lead is
visible in both treatments, and that the detail — and only the detail — is not.

### What building the variants found

Two things that were read out of a running browser rather than predicted, and both changed the
implementation:

- **`display: flex` on a `<summary>` removes the browser's disclosure marker.** The first capture had
  three headings that looked like static text and opened when tapped. Fixed with `list-none` and an
  explicit chevron, which is `aria-hidden` because `<summary>` already reports its own expanded state.
- **A `<summary>` holding a bare `<span>` puts nothing in the document outline.** The accessibility
  tree reported three disclosure triangles and no headings, so a screen-reader user listing the page's
  headings would not have found the three things the page most wants to tell them. `summary`'s content
  model admits one heading element, so the heading moved inside it — which is why the disclosure
  treatment costs nothing against the expanded one on this axis, and why
  `standing-notices.test.tsx` asserts the heading role in **both** treatments rather than in one.

## States and ranges

The component reads nothing and has no states. That is the point of it: no `empty`, no `loading`, no
`error`, no `permission denied`, and no boundary — it is three constant strings, so there is nothing
that can fail to arrive and nothing that can be stale. `docs/policy/ux.md`'s six-state set applies to
a surface that has data; this one has none, and saying so is the honest answer rather than an
omission.

It renders identically signed out and signed in. There is no per-reader variation, and there must not
be one: a notice that softened once somebody had an account would be the thing the tone matrix's
Warmth 5→3 row exists to refuse.

## Constraints a builder must not invent

- **The copy is not this brief's to write.** Statement one is
  [`voice.md`](../../docs/policy/voice.md)'s own Before/After #1, taken as approved. Statement two is
  [ADR-0007](../../docs/adr/0007-the-platform-never-handles-money.md). Statement three is
  `CONTEXT.md`'s amended Block entry. A builder who finds a better sentence has found a change to one
  of those three files.
- **No third colour, no `dark:`, no colour value.** Semantic tokens only; `theme-parity` is light.
- **The display face carries the headings and nothing else here.** No statement body in Alegreya —
  the display face means "a heading, or she wrote it", and the platform wrote all of this.
- **No exclamation mark, no ALL CAPS, no `aquí` as link text.** All three are countable and all three
  are asserted by `testing/surface-copy.ts`.
- **No spec identifier in any rendered string.** `pnpm spec-identifiers` is the machine half.

## Anti-goals

- **No trust badge, no shield, no "verificado" in any construction.** The word is on
  [`voice.md`](../../docs/policy/voice.md)'s Never-say list and on `testing/voice.ts`'s machine list.
- **No dismissal, no "no volver a mostrar", no cookie that remembers.** A notice a reader can turn
  off is a notice the product stops making. It is standing, which is the whole of what "standing"
  means here.
- **No link to a longer page.** `/privacy` is a different document with a different owner, and
  routing the three statements into a click would be the small-print shape this refuses.
- **No About page.** [`voice.md`](../../docs/policy/voice.md) and `site-footer/messages.ts` both
  mention "story 11's About page" in passing. No acceptance criterion on the ticket asks for one and
  the spec's story 11 is the notices alone, so it is not built here. If it is wanted it is a ticket,
  and this line is where that was decided rather than forgotten.
- **No claim about verification or money anywhere else.** `testing/list-copy.ts` already asserts the
  two lists' own copy modules stay silent about both, and that assertion is what keeps this component
  the single source.

## Amended: the foot of the page

**2026-09-12, [#276](https://github.com/m0t0r/recomencemos/issues/276).** Decided in the UX lab on
`prototype/ux-lab` at `f68ab0f` — the notices idea, variant **A, _El bloque_**: today's shape, a
heading and three disclosures, kept as one block. **With one change**, in the owner's words:
_"should be displayed at the bottom, not at the top."_ Rejected: B (_La franja_, a strip under the
header on every page) and C (_En el momento_, each sentence pinned beside the button where that
decision is taken).

**What moved, and what did not.** Only the position. The copy, the order of the three statements,
the `lead`/`detail` split, the `disclosure`/`expanded` treatments, the heading levels, the
component and the one copy module are all unchanged, and #22's copy tests are untouched. The
treatment rule — `disclosure` where the notices sit next to content the reader came for — still
picks `disclosure` on the two lists: at the foot they follow that content instead of preceding it,
and three expanded details there would add the same wall of platform prose that #220 measured at
roughly 900 px on a profile, between the last person and the page's end.

| Surface                                                                   | Where the block sits                                                                                                 | Decided by                                                                                 |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `/` (Wall)                                                                | Below the list and its link to `/profiles`, inside the recent-profiles section, before _Cómo funciona_. Heading `h3` | This ticket — "below the list" is the ticket's own reading of "bottom"                     |
| `/profiles`                                                               | Below the list, below every page `MoreProfiles` appends, and at the foot of a `?after=` page. Heading `h2`           | Same                                                                                       |
| `/profile/[slug]`                                                         | Already at the foot, and it stays last in the document                                                               | Unchanged                                                                                  |
| `/offers`, `/sent-offers`, `/my-profile`                                  | Already at the foot                                                                                                  | Unchanged                                                                                  |
| `/offers/[id]` — the One Offer page and, once built, the Contact Exchange | At the foot: terms → who sent it → her answer → the block. **Not** moved beside the decision                         | **The owner**, asked in the Build session on 2026-09-12 — a product call, not a layout one |

**Two further owner decisions, both taken the same day:**

- **No link from the top down to the block.** The ticket offered one as costing nothing; the owner
  declined it. The block is at the foot and a reader who wants it scrolls there. This sits beside the
  anti-goal above — no link to a longer page — without being the same rule: that one refuses to move
  the statements elsewhere, and this one refuses a second pointer to where they already are.
- **The decision surfaces keep the foot.** Accepting an Offer already opens a dialog that names what
  crosses, so the decision moment is not bare, and the statements are one scroll below it.

**The profile and #274's write bar.** #274 fixes a bar to the bottom of the screen. It is fixed to the
viewport rather than placed in the document, so it does not compete with the block for "last": the
block stays the last thing in `main`, and the bar has to reserve its own height below it so that it
never covers the block's final disclosure. That reservation is #274's criterion ("must not hide the
page's last lines"), and this is the order it reserves against.

**Outside every list boundary, still.** The argument in "Placement" above survives the move: the
notices sit outside `ListBoundary`, so a failed read still leaves them on screen. What does not
survive is the half about layout shift — _"notices above and outside the boundary cannot be moved by
a grid that shifts below them."_ Below the grid, the notices **do** move, and no fallback can stop
it: the list skeleton draws six rows where a page holds up to twenty-four, so the block, and on the
Wall _Cómo funciona_ after it, is pushed down on every load with more than six people. On a phone
that happens below the fold, and the declined jump link means nothing sends a reader to the block
while it is still moving. What the skeleton still protects is the first screen, the heading and the
top rows, which is why the spec's Wall rows keep **Yes** for that narrower reason. CLS on `/` and
`/profiles` measured 0.0 at 390 × 844 before and after the move.
