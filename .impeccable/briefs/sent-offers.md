# Surface brief: `/sent-offers`

**Target:** `apps/web/app/(site)/sent-offers/` · **Mode:** Read · **Ticket:**
[#24](https://github.com/m0t0r/recomencemos/issues/24), story 6 · **Shaped:** 2026-09-08 ·
**Locked:** 2026-09-09, **variant B** ("la persona primero") — three compositions built and
compared running at 390px against four Offers in four states; the losing two are in
[#237](https://github.com/m0t0r/recomencemos/pull/237)

**Written from the spec, `PRODUCT.md`, `docs/policy/voice.md` and `DESIGN.md` with no answer
round**, on the same terms as `send-offer.md`: `[settled]` where one of those settles it,
`[open]` where it is composition, and every `[open]` becomes a `?variant=` on the real route.

## Job and audience

**A Hirer who sent something and is wondering what happened to it.** He is here for one reason
and it is not nostalgia: he wants to know whether the thing he wrote has reached the person he
wrote it to, and if not, when it will. He may be here five minutes after sending, or four days
later having heard nothing.

He is the same reader `send-offer.md` describes and he arrives in a worse mood. Warmth 5→3
still holds; what he needs is a **state per row and a number**, not reassurance.

**This surface is the only place the platform's own delay is visible to the person waiting on
it.** That makes it the surface where an honest instrument matters most: NFR7 gives every Offer
a 24-hour review band and there is nobody on call. If this page cannot say _this one is taking
longer than usual_, the operator's queue depth is a number only the operator can see.

## Outcome and proof

**The primary thing to understand:** which of the things he sent are still waiting, and what
"waiting" means here.

**Success, stated so it can be measured rather than felt** — at 390 × 844, with five Offers in
mixed states:

| #   | Criterion                                                                                                                              |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Every row says **who it went to** and **which state it is in**, in that order, without a tap                                           |
| 2   | A `pending_review` row **states the normal window up front** — before it has passed it, not only after                                 |
| 3   | Past 24 hours the row says plainly that **this one is taking longer than usual**, and it is a sentence rather than a colour or a badge |
| 4   | The terms he wrote are readable from this page, because "what did I actually promise" is the second question every reader has          |
| 5   | Nothing on the page is her phone, her email or her full name — none has crossed, and the page shows nothing that suggests otherwise    |
| 6   | The empty state **routes into `/profiles`** and does not read as an error                                                              |
| 7   | Rows stream under a Suspense boundary whose fallback holds the row's height                                                            |

**Product-specific truth.** A marketplace's "sent" list is an outbox with read receipts and
nudges. This one has neither and can have neither: there is no read receipt, because delivery
means _a person let it through_ and not _she opened it_; and there is no nudge, because
principle 1 says the platform introduces and leaves. **The absence of a follow-up control is a
design decision, and the page must not look like one is missing.**

## Selected direction

**Structural thesis: a row is a state and a person, and the state is a sentence.**

The seven Offer states are not equally interesting to him. Three matter — waiting, delayed,
and delivered — and the rest are terminal facts he reads once. So the row leads with the state
in his own terms and the person it is about, and the terms he wrote sit underneath.

**`[settled]`, and out of scope for a variant:**

- **`reviewDelayed` is derived, never stored.** _Amended 2026-09-09: this said "a plain
  sentence. Not a badge" — and the row now carries **both**, at the Design lead's call._ The
  argument the original made is intact and is what shapes the badge: `voice.md` refuses meaning
  carried by colour alone, so the badge is a **text label**, readable with the stylesheet off
  and announced by a screen reader; and an alarm aimed at somebody who cannot act on it is
  pressure, so the delayed badge is `secondary` rather than `destructive` and **no state on this
  surface is ever red**. What the badge buys is what a sentence cannot: four rows scan as four
  states in one glance. The sentence stays beside it, because _normalmente toma menos de un día_
  is the part a label has no room for.
- **The normal window is stated before it is exceeded.** Do 2 — the absence first — applied to a
  wait: telling him the window only once it has been missed is telling him too late to matter.
- **No contact detail of hers anywhere on this page**, whatever the state. `SentOffer` carries
  state only; the projection is what enforces it and the page must not reach around it.
- **No nudge, no resend, no "ask again", no cancel.** An Offer is immutable and the platform
  does not chase.
- **Semantic tokens only, registry components only, light only.**
- **`noindex`**, both halves: the prefix is already on `GATED_ROUTE_PREFIXES`, and the page sets
  its own `metadata.robots`.

**`[open]`, and each becomes a variant:**

1. ~~The row's shape.~~ **Her identity leads**, the state is a line beneath it. He remembers his
   Offers by who he wrote to, so the nameplate is the scanning anchor.
2. ~~Where the terms sit.~~ **Always visible.** A disclosure on a list of five is a tap that
   buys nothing.
3. ~~How a delayed row differs.~~ **An extra line, plus its own badge.** _Still waiting_ and
   _taking longer than usual_ are two facts, and overwriting the first with the second loses the
   window he was promised.

## Scope and boundaries

- **Fidelity:** production.
- **Breadth:** the route, its four states, the row, and the empty state.
- **Untouched:** the projection and what it carries; `SiteHeader` and the footer; the standing
  notices' treatment elsewhere.
- **Anti-goals:** no search, no filter, no sort control, no pagination at launch volume, no
  counts of anything, no illustration in the empty state, no progress bar over a human's queue.

## States and ranges

| State               | What it shows                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `empty`             | He has sent none. Say what sending one is for, and route into `/profiles`. Never an illustration and never "nothing here yet".        |
| `loading`           | Row skeletons at the row's height, so the heading above them does not move.                                                           |
| `partial`           | Some rows painted, the rest streaming.                                                                                                |
| `error`             | The list failed to load: what failed, that retrying helps, and the page's own chrome still renders.                                   |
| `permission denied` | Signed out → `/sign-in` with a way back. There is no not-the-sender case: the read is scoped by the principal, so it returns nothing. |

**Ranges:** 0, 1, 5 and 40 rows; every state in `OFFER_STATES` present at least once across the
fixtures; a 600-character `workDescription` beside a 20-character one; a Worker with a
103-character headline and one with a short one.

## Interaction and layout

Single column, `max-w-3xl`, the phone first.

**Reading order:** heading → the rows, newest first → nothing else. One `<h1>`, one heading per
row is too many — the row's state is a sentence, not a section.

**Keyboard and announcement:**

- Each row's link to the Worker's profile is reachable and names its destination.
- The list announces its count once when the boundary resolves, not per row — the rule the Wall
  and `/profiles` already follow.
- A `<details>` (if variant 2 wins) is native, so it needs no JavaScript and no ARIA of its own.

**No motion.**

## Constraints

- **WCAG 2.2 AA.** The delayed state is a sentence, not a colour; every link names its
  destination; contrast on every pair.
- **NFR4.** The page renders without JavaScript. It has no form, so this is a claim about the
  streamed boundary rather than about a postback — and a Suspense boundary is revealed by an
  inline script, so "no JavaScript" here means what the document carries before hydration.
- **NFR3's byte budget.** Re-measure with `pnpm page-weight`.
- **No spec identifier in any rendered string.**
- **Verified running** at seam 3 through `next-dev-loop`. This route does not exist on the
  default branch, so it has **no before** and the pull request says so rather than manufacturing
  one; the story demo is what shows it working.
