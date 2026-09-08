# Surface brief: `/profile/[slug]`

**Target:** `apps/web/app/(site)/profile/[slug]/` · **Mode:** Read · **Ticket:**
[#220](https://github.com/m0t0r/recomencemos/issues/220), iterating on story 5
([#23](https://github.com/m0t0r/recomencemos/issues/23)) · **Shaped:** 2026-09-08 · **Locked:**
2026-09-08, **variant A** ("retrato y frase") — three candidates built and compared _running_ at
390px against two fixtures; the losing two are in [#220](https://github.com/m0t0r/recomencemos/issues/220)

**Mode is Read, and that is the first decision.** Every other brief in this directory is Operate.
Nothing on this page is a task: there is no form, no control, one link out. The visitor is
understanding a person well enough to decide whether to write to her. Structure for comprehension
first, then make it worth staying in.

**Shaped with one answer round**, on the two decisions the ticket delegates rather than settles: the
standing notices' treatment on this route, and whether the reshape covers the whole page. Both
answered 2026-09-08 — **collapsed disclosure**, and **the whole page**. Everything else below is
`[settled]` by the ticket, `DESIGN.md`, `voice.md` or the spec, named where it is used; the
composition itself is `[open]` by design and goes to `/prototype`.

## Job and audience

**A signed-in Hirer, one tap after a row on the Wall or `/profiles`, on a phone.** He has already
chosen this person — that is what the tap was — so this page is not competing for his attention. He
came to answer one question: **can she do the thing I need done, and is she someone I am willing to
write to?**

He is not the person this product's voice protects. But she is the person on this page, and the page
is the closest thing she has to standing in front of him.

The second reader is **the Worker herself**, who reaches the same route to see what he sees. That is
not a separate design; it is the reason nothing here may read as an assessment of her.

## Outcome and proof

**The primary thing to understand:** that this is one person, and what she can do. The face, the
name, the city and her own sentence are **one object**, not four facts stacked in a column.

**Success, stated so it can be measured rather than felt** — at 390 × 844, on a profile with a
103-character headline and six Skills:

| #   | Criterion                                                                                            | Today                                             |
| --- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 1   | Face, name, city and the first line of her own words all land within the **first 200px** of `<main>` | name is at 244px; nothing connects it to the face |
| 2   | The identity block is **≤ 300px tall** — it introduces her, it is not the page                       | 458px, 54% of the viewport                        |
| 3   | A 103-character headline sets in **≤ 4 lines**                                                       | 7                                                 |
| 4   | Skill chips reach **≥ 2 per row**                                                                    | 1 per row, six rows                               |
| 5   | The page reads as **one document**, not a floating header above a ruled one                          | header sits outside `ruled-page`                  |

**Product-specific truth.** Every neighbouring product puts the name in the largest type and the
capability in a subtitle — that is what a directory of people looks like. This one inverts it, and
the inversion is load-bearing: **she is described by what she can do, never by what happened to
her** ([ADR-0009](../../docs/adr/0009-a-workers-full-identity-is-gated-and-never-indexed.md),
PRODUCT.md principle 3). The failure this page must not commit is not ugliness. It is making a
person look like a case file.

## The mechanical cause, measured

`gated-profile-view.tsx`'s `<header>` is `flex gap-4` — a 40px avatar in a left gutter, everything
else in the column beside it. **That is a row's composition, and it is correct in a row**, where the
avatar is a scanning anchor across many people and the headline is one or two lines.

On a page about one person it fails three ways at once, and they share a cause:

```
avatar   40 × 40   at y=97           the gutter is 56px wide and 458px tall
h1      302 × 240  at y=97, 7 lines  ← starved of 56px for its whole height
name    302 × 20   at y=341          ← 244px below the headline's top
chips   302 × 186  at y=369, 6 rows  ← 170px chips in a 302px column
```

**418px of that gutter is empty.** One 56px column, held open the full height of the block for a
40px circle, is what squeezes the headline into seven lines _and_ forces every chip onto its own
row. The ticket's "three unrelated pieces" is the felt version of one structural mistake.

## Selected direction

**Structural thesis: break the gutter, and make the face and the name one object.**

The identity — portrait, name, city — becomes a single horizontal unit whose parts are adjacent by
construction, and **her words get the full measure of the page.** No element holds a column open for
another element's whole height.

**The heading step is re-decided, not inherited** (acceptance criterion 2). `page-heading` is 32px
Alegreya with `text-balance`, and `DESIGN.md` describes it as the step "every `<h1>` in the product
carries" — but it was drawn for a page _title_: _Todos los perfiles_, _Cómo funciona_, two to four
words. **Her headline is a sentence of up to 120 characters.** `DESIGN.md`'s own rules say prose
sits at 65–75ch and that `text-balance` is for short titles; a 103-character sentence at 32px on a
390px phone is not a title, it is a pull-quote, and it is being set with a title's tooling.

The variants test the step rather than assert it. The candidate the brief favours is **the 24px h3
step — the same step her words already take in a row and on a card** — which would make one rule
true everywhere: _her words are 24px Alegreya on every surface in the product, and only the
composition around them changes._ That is a smaller design than the current one, and a more
consistent product.

**Consequence to declare, not to slip through:** if a variant below 32px wins, this page's `<h1>`
stops carrying `page-heading`, and `DESIGN.md`'s sentence about that class becomes untrue as
written. It gets one clause — the step is for a page title, and a surface whose `<h1>` is a person's
own sentence sets it at the step that suits a sentence. Named here so the winner arrives with its
cost attached.

**Focal moment:** the first 200px. Face, name and the opening words of her sentence, taken in as one
thing before anything is scrolled.

**Implementation consequence:** the portrait needs a step the registry does not have. `Avatar` ships
`sm` 24 / `default` 32 / `lg` 40; a page portrait wants **64px**, so `xl` is **added to the
registry** (criterion 3) — with its fallback initial and `AvatarBadge` scaled with it, since a 64px
circle carrying a `text-sm` letter is a bug, not a size. No one-off class on this page.

## Scope and boundaries

- **Fidelity:** production.
- **Breadth:** the whole page composition — identity block, the two sections, the rhythm between
  them, the back-link, and the notices' treatment. The route, its four refusals, the streaming
  boundary, the projection and every string stay exactly as they are.
- **Untouched, and each for a reason:**
  - **The `<h1>` is the headline and the name is subordinate to it.** Out of bounds on the ticket,
    argued in the component's class comment and ADR-0009. How it _looks_ — size, weight, order on
    screen, the relation of face to name — is entirely in scope. **No variant inverts it.**
  - **No copy changes.** `voice.md` and `_lib/messages.ts` are unchanged by this ticket.
  - The `<Suspense>` boundary around the work history, and the promise handed to it. A reshape that
    made that boundary decorative would be a regression the diff would not show.
  - The four route refusals, `noindex`, the ceiling, and the missing-profile response.
- **Anti-goals:** no rating, no score, no "member since", no completeness meter, no verification
  badge or its absence rendered as a badge, no second cover, no card around the whole page, no
  texture. Nothing that reads as an assessment of her.

## States and ranges

| State                     | What it shows                                                                                                                                                                                                                                  |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `loading`                 | `PanelSkeleton` at the **new** shape. It is a promise about the layout; a skeleton at the old geometry would be a jump.                                                                                                                        |
| `partial`                 | Work history streams in under its own boundary; a profile with none renders no section at all.                                                                                                                                                 |
| `empty`                   | No `about` and no work history → `NOTHING_MORE`, in the self-description's place.                                                                                                                                                              |
| `photo absent or pending` | Her initial in the same circle at the same size. **One shape, two causes, never a badge** — and at 64px this is the _common_ case at launch, so the initial state must be the one the composition is drawn for, not the fallback it tolerates. |
| `permission denied`       | Signed out → `/sign-in` with a way back. Frozen or unknown slug → the missing-profile response. Both unchanged.                                                                                                                                |
| `ceiling refused`         | `ReadPaused`. Unchanged, and the notices still render around it.                                                                                                                                                                               |

**Ranges, and every variant is judged against both ends.** Headline **20–120** characters
(`LIMITS.headline`); `about` **0–600**, with paragraph breaks she typed; work history **0–5** lines
of ≤120; Skills **1–6**, labels up to ~35 characters and every one a verb phrase; name = first name

- one initial; three cities. **Two fixtures, not one** — a short headline with two Skills, and a
  103-character headline with six. A composition that only works at one end is not a composition.

## Interaction and layout

Single column, `max-w-3xl`, top-aligned; the phone is the primary surface and the desktop is the
adaptation.

**Reading order:** identity → her words → her Skills → what she says about herself → what she has
done → back to the list → the three standing notices. One `<h1>` (her headline), `<h2>` per section,
so the heading list reads as the page's structure.

**Keyboard and screen-reader path is unchanged and must stay unchanged:** heading → the two section
headings → the back link → the notices' disclosures. Nothing new is focusable. The portrait is
`aria-hidden` while it holds an initial, because the name is announced anyway; a real photo keeps
its Spanish `alt` and that `alt` never describes her circumstances.

**Notices: `disclosure`, decided 2026-09-08.** Today all three render `expanded` at the foot — three
headings, three leads, three details, after the back-link. The reader has already chosen this person
and is deciding whether to write to her: the statements must be present and findable, and they must
not put ~900px of platform prose between her work history and the one link out. `disclosure` keeps
every heading and every lead on screen and puts only the explanation a tap away. **What a tap hides
is never a criterion** — `messages.ts` already splits `lead` from `detail` precisely so this prop
cannot decide what the product says. They stay outside the `<Suspense>`, so a refused read still
carries them.

**No motion.** Product UI loads into a task; nothing here has a transition to earn.

## Constraints and open decisions

- **WCAG 2.2 AA.** Contrast on every pair; the name and city are not the only thing distinguishing
  identity from content; nothing meaningful carried by colour or position alone.
- **Semantic tokens only**, registry components only. The `xl` avatar step is a **registry
  addition**, and `packages/design-system/CLAUDE.md`'s rules govern it.
- **NFR3's byte budget and NFR4.** The page ships no new client JavaScript; every element here is a
  Server Component and the notices' disclosure is native `<details>`. Re-measure with
  `pnpm page-weight` rather than quoting a figure.
- **Light only.** No `dark:` overrides.
- **Verified running** at seam 3 through `next-dev-loop`; the before/after still pair is the recorded
  proof. `pnpm ui-proof publish` still refuses ([#182](https://github.com/m0t0r/recomencemos/issues/182),
  [#183](https://github.com/m0t0r/recomencemos/issues/183)), so the artifacts are local and the
  accessibility-tree diff is pasted.

## What was chosen, and what it measured

**Variant A — the portrait leads.** A 64px face with her name and city set beside it as one
nameplate, then her sentence at the 24px step on the page's full measure, then her Skills. Picked
live at 390px rather than from a screenshot.

| at 390 × 844, 103-char headline, six Skills | before                          | **A**                        |
| ------------------------------------------- | ------------------------------- | ---------------------------- |
| headline                                    | 302 × 240, **7 lines**          | 358 × 128, **4 lines**       |
| face → name                                 | **244px apart**                 | adjacent, vertically centred |
| portrait                                    | 40px                            | **64px**                     |
| chips                                       | 1 per row, six rows, 186px      | 2 per row, four rows, 122px  |
| identity block                              | 458px (**54%** of the viewport) | 374px                        |

**The two losers, and what each was for.** **B** set her sentence first at 28px with the face and
name signing it beneath — the tightest block of the three (366px) and the most notebook-like, a
written line and then who wrote it. **C** was the control that made the argument decidable: identity
compressed to one line with `page-heading` kept at 32px, which still ran to **five** lines and 422px.
C is the evidence that full measure alone was not the fix and the step was really part of the
problem — which is a thing this brief predicted and could not have proved.

**One flaw was carried into the pick and closed in implementation.** At 24px her `<h1>` was the same
face, size, weight and colour as the two section `<h2>`s. The sections drop to the 20px step;
`own-profile-view.tsx` keeps 24px, because its `<h1>` is a 32px page title and it has the step this
page had to buy.

**Nothing about the prototype survived.** The `variant` prop, the switch and the `?variant=` read
were deleted with the pick.
