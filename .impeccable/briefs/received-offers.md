# Surface brief: `/offers`

**Target:** `apps/web/app/(site)/offers/page.tsx`, and `apps/web/app/(site)/offers/[id]/page.tsx`
as the same surface with one row open · **Mode:** Operate · **Ticket:**
[#271](https://github.com/m0t0r/recomencemos/issues/271), under
[#178](https://github.com/m0t0r/recomencemos/issues/178) · **Shaped:** 2026-09-12 ·
**Settled in the UX lab:** idea 1, **variant A — _El cuaderno_**, on `prototype/ux-lab` at
`f68ab0f` (`apps/web/app/(site)/prototype/offers/_components/ledger.tsx`). Rejected there: B
(_Una a la vez_, one full-screen card at a time) and C (_Lado a lado_, columns to compare).

**Supersedes** the story 8 brief for this route, which was a list with no decision on it and a
separate page per Offer. The decision criteria of [`received-offer.md`](received-offer.md) — terms
before controls, equal weight, the dialog that names what crosses — are carried in whole below; that
brief's layout is not.

**Shape round, 2026-09-12**, three answers from the owner: _Reportar_ waits for story 10; story 8's
words stay; `/offers/<id>` is this ledger with that row open.

## Job and audience

**A Worker reading the Offers that reached her, on a phone, and deciding on the one in front of
her.** She arrives from the menu, or from the delivery email's link to one Offer. She wants three
things in this order: _is anything waiting on me_, _what is it and what does it pay_, and _if I say
yes, what happens_. Tone is **Reading an Offer (Worker)**, unchanged: everything in front of her,
nothing nudging.

## Outcome and proof

**The primary thing to do:** read, decide and see the result without ever leaving the list.

At 390 × 844, against Offers in all four received states:

| #   | Criterion                                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Every Offer is a ruled row saying, shut: **who signed it** (as a claim), **how long ago**, the **first lines of the work**, its **state in words**, and the **pay** |
| 2   | The heading block says **how many still wait on her**, and that **a person read each Offer before it arrived**                                                      |
| 3   | A row **opens in place** — no navigation — to the state, the three terms, the sent date, who claims to have sent it, and, while waiting, the answer                 |
| 4   | The terms come **before** the controls, and _Aceptar_ and _No aceptar_ carry **equal weight**                                                                       |
| 5   | _Aceptar_ is **two steps**; the second **names what crosses in both directions** and **that it cannot be undone**, and is reachable from a keyboard                 |
| 6   | After an answer she is **on her row, open**, with the result in it, **focused and announced** as a `status`                                                         |
| 7   | An answered row **stays**, saying what she answered; an answered or expired row has **no controls**                                                                 |
| 8   | The email's `/offers/<id>` lands on **that row, open**, with and without JavaScript; somebody else's id is **the same 404** as a missing one                        |
| 9   | Nothing is his phone or email, or her own full name, phone or email — nothing has crossed                                                                           |

**Product-specific truth.** An inbox ranks, badges and nudges because its business is the reply.
This one is principle 1 — _introduce, then leave_ — so the only number on the page is a count, said
in words, of what still waits; and the one interruption is the dialog that says what her yes gives
away.

## Selected direction

**Structural thesis: a notebook of rows, each one a note that opens where it lies.** The row is the
Offer; opening it is reading it; its foot is the answer.

**`[settled]`:**

- **One ledger, newest first**, rows divided by the ruling and the margin line beside them from
  `sm` up (`DESIGN.md` → Layout). No sections: a waiting pile above an answered one is the platform
  sorting her Offers for her.
- **A row is a native `<details>`.** It opens before hydration and without JavaScript, and the server
  sets `open` on the row a link names — which is what makes the email's link land on that Offer. The
  registry's accordion needs the script to open; the standing notices made the same call.
- **`/offers/[id]` is this ledger with that row open.** One read, one layout; the actions still
  redirect to `/offers/<id>?answered=…`, which is now her row with the result in it.
- **The row leads with the name, said as a signature** — _Firma como Carlos Restrepo_, or _Firma sin
  nombre_ — in the display face, because it is the row's heading. Inside the open row, _Aquí no
  verificamos a nadie_ comes before the name again, beside the decision it bears on.
- **How long ago is elapsed time**: _hace menos de una hora_, _hace 5 horas_, _hace 3 días_ — never
  _ayer_, which elapsed hours cannot always make true.
- **Story 8's words**: _Por responder / Aceptada / No aceptada / Vencida_, and _No aceptar_. The lab's
  _Acordada_ says the two agreed on the work, which the platform never knows.
- **The dialog second step, equal weight, _Aceptar y dar mis datos_**, all as `received-offer.md`
  settled them.
- **_Reportar_ is story 10's** ([#27](https://github.com/m0t0r/recomencemos/issues/27)). It joins the
  answer as a third control, and the answer's buttons wrap rather than shrink so it fits without a
  re-layout. No disabled stub stands in for it.
- **The Contact Exchange is story 9's** ([#26](https://github.com/m0t0r/recomencemos/issues/26)). An
  accepted row is where it lands; until then the row says _La aceptaste._
- **No Hirer location.** The lab showed one; the product holds none, and the Hirer is anyone,
  anywhere.
- **Semantic tokens only, registry components only, light only. `noindex`, both halves.**

## Scope and boundaries

- **Fidelity:** production. **Breadth:** both routes, every received state, the answer, its
  refusals, the empty and failed states.
- **Untouched:** the domain and its projections; the two actions' bodies; the delivery email; the
  standing notices; `SiteHeader`.
- **Anti-goals:** no search, filter, sort or pagination at launch volume; no unread dot; no colour
  that means hurry; no reply box, counter-offer, rating, _save for later_ or timer; no row open by
  default at `/offers`.

## States and ranges

| State               | What it shows                                                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `empty`             | Nothing has reached her: what makes an Offer arrive, that a person reads each first, and a route to her profile — or to `/publish` if she has none     |
| `loading`           | Row skeletons at a shut row's height, and a line where the waiting count goes, so the heading does not move                                            |
| `partial`           | The heading and lead painted; the count and the rows streaming, off one read                                                                           |
| `error`             | The list failed: what failed, that retrying helps, and that nothing she answered changed — for both routes                                             |
| `permission denied` | Signed out → `/sign-in` with a way back. At `/offers/[id]`, an Offer not in her list → 404, returned                                                   |
| `success`           | Accepted → _Aceptaste esta propuesta._ in the row. Declined → confirmed in the row, and it stays confirmed on every later visit                        |
| refused             | Answered already in another tab → she is told so, on the row that shows what it is. No longer hers to answer → an `alert` that says where the rest are |

**Ranges:** 0, 1, 5 and 40 rows; each received state at least once; a 600-character work description
beside a 20-character one; a 60-character Hirer name and a `null` one.

## Interaction and layout

Single column, `max-w-3xl`, the phone first.

**Reading order:** heading → lead → waiting count → the rows → the standing notices. Inside an open
row: the result of an answer, if any → the state sentence → the three terms → the sent date → who
claims to have sent it → the answer.

**Keyboard and announcement:**

- Each row's summary is one control that reports its expanded state; opening it puts the row's
  content next in reading order.
- A deep link focuses its open row's summary, which scrolls it into view.
- After an answer, the result inside the row is an `<output>` that takes focus on mount — so it is
  announced once, politely.
- The dialog opens on _Volver_ and returns focus to _Aceptar_ on close.
- The list announces its count once when it resolves, not per row.

**Motion:** the chevron's turn, and what the registry's dialog ships. Nothing else.

## Constraints

- **WCAG 2.2 AA.** State in words; every control names its act; focus visible.
- **NFR3's byte budget.** `/offers` now carries the answer's dialog; re-measure with
  `pnpm page-weight` and say the compression.
- **No spec identifier in any rendered string**, and every `id` on the page unique — many answer
  regions share one page now.
- **Verified running** at seam 3 at 390 px, with a before/after capture of the flow and the story
  demo.
