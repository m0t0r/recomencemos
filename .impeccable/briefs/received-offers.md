# Surface brief: `/offers`

**Target:** `apps/web/app/(site)/offers/page.tsx` · **Mode:** Read · **Ticket:**
[#25](https://github.com/m0t0r/recomencemos/issues/25), story 8 · **Shaped:** 2026-09-10

**Written from the spec, `PRODUCT.md`, `docs/policy/voice.md` and `DESIGN.md` with no answer
round**, on the terms `sent-offers.md` set: `[settled]` where one of those settles it, `[open]`
where it is composition, and every `[open]` becomes a `?variant=` on the real route.

## Job and audience

**A Worker who has been told an Offer reached her.** The email that says so links to the Offer
itself; she arrives here either from that link's back-path or from the menu, on a phone, often a
borrowed one, often on mobile data. She wants to know three things, in this order: _is there
something waiting for my answer_, _what is it asking and what does it pay_, and _who claims to be
asking_.

Tone is **Reading an Offer (Worker)** from the voice guide, unchanged: everything in front of her,
nothing nudging. No _¡Nueva propuesta!_, no unread dot, no countdown, no count of how many are
waiting in a colour that means hurry.

## Outcome and proof

**The primary thing to understand:** which Offers still need her answer, and what each one is.

At 390 × 844, with five Offers across four states:

| #   | Criterion                                                                                                                          |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Every row says **what work** and **what pay** without a tap                                                                        |
| 2   | A row still waiting on her answer is told apart from an answered one **by words**, not by colour or position                       |
| 3   | The name he gave is on the row and is **said to be his own claim**; an Offer with no name says so rather than rendering a blank    |
| 4   | Each row opens the Offer through a link that **names its destination**                                                             |
| 5   | **No accept or decline control on this page.** The decision is made with the full terms in front of her, which is the Offer's page |
| 6   | A declined Offer is **still here, as declined** — a decision she made is one she can come back and read                            |
| 7   | Nothing on the page is his phone, his email, or anything of hers that crosses only at acceptance                                   |
| 8   | The empty state says **what makes an Offer arrive** and **that a person reads each one first**, and does not read as an error      |
| 9   | Rows stream under a Suspense boundary whose fallback holds the row's height                                                        |

**Product-specific truth.** A marketplace inbox ranks, badges and nudges, because its business is
the reply. This one is **principle 1 — introduce, then leave**: the page's job ends at "here is what
arrived", and a page that pressed her to answer would be the platform standing between two people
rather than stepping out.

## Selected direction

**Structural thesis: a row is an Offer, and it reads like the note it is.** Work, pay and when are
what the Hirer wrote; the state is ours to say; the name is his claim.

**`[settled]`, and out of scope for a variant:**

- **Only what a person let through.** `RECEIVED_OFFER_STATES` — delivered, accepted, declined,
  expired. An Offer still in review is not hers yet; one she Reported is hidden from her.
- **No decision controls on the list.** The ticket's own words: _what she is agreeing to is what she
  can see_, and a row is a summary.
- **The name is badged as declared** (C4). Absence first: _Aquí no verificamos a nadie_ is the
  sentence the Wall's notice already says; the row points at it rather than restating it.
- **The state is a text label and a sentence**, as `/sent-offers` settled: readable with the
  stylesheet off, announced by a screen reader, and **never red** — nothing on this page is an alarm.
- **A ruled list** (`DESIGN.md` → Layout). Rows are separated by the ruling, never by cards.
- **Newest first**, on the index DD2 already built for exactly this read.
- **`noindex`**, both halves: the prefix is on `GATED_ROUTE_PREFIXES`, and the page sets its own
  `metadata.robots`.
- **Semantic tokens only, registry components only, light only.**

**`[open]`, and each becomes a variant:**

1. **What leads the row.** The work (_what is being asked_), the person (_who is asking_), or the pay
   (_what it is worth_). Each is a real reading order and each is the first question for somebody.
2. **Whether waiting and answered are one list or two.** One list, newest first, with the state on
   each row — or a _por responder_ section above an _ya respondiste_ section.
3. **How much of the terms a row carries.** The work and the pay in full, or the work cut to two
   lines with the rest on the Offer's page.

## Scope and boundaries

- **Fidelity:** production.
- **Breadth:** the route, its states, the row, the empty state, the session-menu entry that reaches
  it.
- **Untouched:** the projection; `SiteHeader`; the standing notices' treatment elsewhere; the
  delivery email.
- **Anti-goals:** no search, no filter, no sort control, no pagination at launch volume, no unread
  state, no count in the header, no illustration in the empty state.

## States and ranges

| State               | What it shows                                                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `empty`             | Nothing has reached her. What makes an Offer arrive, that a person reads each first, and a route to her own profile — or to `/publish` if she has none |
| `loading`           | Row skeletons at the row's height, so the heading above does not move                                                                                  |
| `partial`           | Some rows painted, the rest streaming                                                                                                                  |
| `error`             | The list failed to load: what failed, that retrying helps, and that nothing she decided has changed                                                    |
| `permission denied` | Signed out → `/sign-in` with a way back. There is no not-the-owner case: the read is scoped by the principal, so it returns nothing                    |

**Ranges:** 0, 1, 5 and 40 rows; each of the four received states at least once; a 600-character
`workDescription` beside a 20-character one; a Hirer name of 60 characters and one that is `null`.

## Interaction and layout

Single column, `max-w-3xl`, the phone first.

**Reading order:** heading → lead → the rows → the standing notices.

**Keyboard and announcement:**

- Each row's link is reachable and names its destination.
- The list announces its count once when the boundary resolves, not per row — the rule the Wall,
  `/profiles` and `/sent-offers` already follow.

**No motion.**

## Constraints

- **WCAG 2.2 AA.** State in words; every link names its destination; contrast on every pair.
- **NFR3's byte budget.** Re-measure with `pnpm page-weight`.
- **No spec identifier in any rendered string.**
- **Verified running** at seam 3. The route does not exist on the default branch, so there is **no
  before** and the pull request says so; the story demo is what shows it working.
