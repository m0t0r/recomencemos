# Surface brief: `/offers`

**Target:** `apps/web/app/(site)/offers/page.tsx`, and `apps/web/app/(site)/offers/[id]/page.tsx`
as the same surface with one Offer open · **Mode:** Operate and Read · **Ticket:**
[#304](https://github.com/m0t0r/recomencemos/issues/304), under
[#178](https://github.com/m0t0r/recomencemos/issues/178) · **Shaped:** 2026-09-14 · **Settled on
the prototype:** **variant D — _Correo_**, on `prototype/offers-mailbox` at `8837ad3`
(`apps/web/app/(site)/offers/_prototype/variant-d-mail.tsx`). Rejected there: A (_Dos cajones_), B
(_Una sola lista_), C (_Quién sigue_).

**Supersedes and merges** `received-offers.md` (#271, _El cuaderno_) and `sent-offers.md` (#24, _la
persona primero_). Both are deleted with this brief. Their **words, states and refusals** are
carried below whole; their **layouts** are not. Neither route keeps its own shape: the received
notebook of `<details>` rows and the always-open sent rows become one list and one reading pane.
The decision criteria of [`received-offer.md`](received-offer.md) (terms before controls, equal
weight, the dialog that names what crosses) are unchanged.

## Job and audience

**Anyone with an Offer in either direction, on a phone first.** Two readers, and often one person:

- **A Worker reading what reached her and deciding on the one in front of her.** She wants, in
  order: _is anything waiting on me_, _what is it and what does it pay_, _if I say yes, what
  happens_. Tone is **Reading an Offer (Worker)**: everything in front of her, nothing nudging.
- **A Hirer wondering what happened to what he sent.** He wants a state per Offer and the normal
  window, and past it a plain sentence that this one is taking longer. Warmth 3, Directness 5.

`CONTEXT.md` lets one Account be both. Today that person has two routes, two designs, and two menu
rows that differ by one verb. This page is one place, and every row says who it is with, where it
stands and whether anything waits on her.

## Outcome and proof

At 390 × 844 first, then at `lg`, against an Account holding Offers in both directions and every
state:

| #   | Criterion                                                                                                                                                                                |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | One route lists every Offer the Account received and every one it sent, newest first                                                                                                     |
| 2   | An Account with both roles sees three folders as **plain links** — _Todas_, _Recibidas_, _Enviadas_ — the current one with `aria-current`, and lands on _Todas_                          |
| 3   | An Account with one role sees **no folders**, only its list                                                                                                                              |
| 4   | Every row names its **direction in words, first** — _De Carlos Restrepo_ / _Para Ana María R._ — then how long ago, a short excerpt of the work, the state label and the pay             |
| 5   | The pay is never cut off, and a row is at least 44 px tall                                                                                                                               |
| 6   | A row is a link to `/offers/<id>`. From `lg` up the folders, list and opened Offer sit side by side; on the phone the list and the Offer are two screens, with _Volver a …_ between them |
| 7   | `/offers/<id>` opens that Offer, with and without JavaScript. Somebody else's id gets the same 404 as a missing one                                                                      |
| 8   | The heading block says how many still wait on her, in words, on the received side only                                                                                                   |
| 9   | Every received and sent state renders with today's words, including the review window before it passes and the delay sentence after                                                      |
| 10  | A closed accepted row says in words that the contact is inside                                                                                                                           |
| 11  | None of mail's signals: no unread styling, no count on a folder, no reply, no sort, no _Bandeja de entrada_, no _Redactar_                                                               |

**Product-specific truth.** Mail's **structure** is familiar here, and so is WhatsApp's: a list of
items, newest first, each saying who it is with. Mail's **signals** are exactly what this product
refuses — bold unread rows, counts, reply, read receipts, archive, stars. Principle 1 is _introduce,
then leave_, so the only number on the page is a count, in words, of what waits on her.

## Selected direction

**Structural thesis: folders, a list, and the Offer she opened — mail's shape, none of its
signals.**

**`[settled]`:**

- **Folders are links, not tabs.** Each has an address (`?box=all|received|sent`) and works without
  JavaScript. The registry `Tabs` is Base UI and needs a script, so the folders are `next/link`s
  wearing the Tabs styling (`default` variant: a grey track, the current folder raised), through
  `tabs-variants`, and carry no `role="tab"`.
- **Every row is a link, and the opened Offer is server-rendered.** `/offers/<id>` is a real path,
  not a fragment, so the delivery email lands on it and a browser without JavaScript opens it.
- **The phone is list, then detail; side by side only at `lg`.** Material's list-detail pattern,
  whose canonical example is email. On the phone's detail screen the heading block is visually
  hidden and stays in the accessibility tree.
- **Direction is words, first in the row** (WCAG 1.4.1). Never an arrow, never a colour alone.
- **A row's accessible name is short.** The work is an excerpt cut on a word, so a screen reader
  listing links hears a row rather than a paragraph.
- **One heading per Offer on both sides:** `h1` _Tus propuestas_ → an `h2` naming the folder → an
  `h3` per row; the opened Offer is an `h2`. The page no longer skips from `h1` to `h3`.
- **Received, opened:** the result of an answer → the state sentence → the three terms → the sent
  date → who claims to have sent it, _Aquí no verificamos a nadie_ before the name → the answer. The
  row's name is said as a claim, _Firma como …_, in the pane's heading.
- **Sent, opened:** her identity leads, then the badge and the sentence. A delayed review gains a
  line rather than replacing one. Then the terms, the date and _Ver el perfil_. No detail of hers
  unless an exchange has crossed.
- **Accepted, either side:** `ContactExchangePanel` leads and the terms fold beneath it.
- **The accept step is unchanged:** `AnswerControls`, two steps, equal weight, and the `Dialog`
  that names what crosses and that it cannot be undone.
- **No state is ever red.** Text labels, `secondary` for waiting and delayed, `outline` for closed.
- **After a send**, `/offers?box=sent&sent=1` carries the three-clause confirmation above the list.
  `/sent-offers` redirects to `/offers?box=sent` and keeps its query.
- **The session menu has one row**, _Tus propuestas_.
- **Semantic tokens only, `lucide` icons only, light only. `noindex`, both halves.**

### Where each part comes from

No registry component was missing, so nothing was added through the CLI. The one element that is not
a registry or existing product component is the send confirmation, carried unchanged from
`/sent-offers` and named in its row below.

| Part of D               | Built from                                                                                                                                                        |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Folder links            | `tabsListVariants` (`default`) and `tabsTriggerVariants` from `tabs-variants` on `next/link`, with Base UI's attributes; `data-active` on the current one         |
| The list                | A `<ul>` of `Item`s — `ItemGroup` is a `div` with `role="list"`, whose rows would need `role="listitem"`, which the lint refuses for the element that means it    |
| A row                   | `Item` with `render={<Link />}`, `ItemHeader`, `ItemTitle`, `ItemContent`, `ItemDescription`                                                                      |
| State                   | `Badge` through `OfferStateBadge` and `offerBadge`                                                                                                                |
| Rulings                 | `Separator`, and `ItemSeparator` between rows                                                                                                                     |
| The opened Offer's pane | A plain `article`, ruled off from the list at `lg` by a `border-l` in the `border` token                                                                          |
| _Volver a …_            | `buttonVariants` (`ghost`) on `next/link`, with `ArrowLeftIcon`                                                                                                   |
| Accept                  | The existing `AnswerControls` and `Dialog`                                                                                                                        |
| Accepted Offers         | The existing `ContactExchangePanel` (`Card`) and `FoldedTerms`                                                                                                    |
| Empty states            | `Empty`, `EmptyHeader`, `EmptyDescription`, `EmptyContent`                                                                                                        |
| Loading                 | `Skeleton` at a row's height, and at the pane's                                                                                                                   |
| After an answer         | The existing `ArrivalStatus`                                                                                                                                      |
| After a send            | An `<output>` with a left rule in the `border` token, carried unchanged from `/sent-offers` — a status, which the registry's `Alert` (a problem announced) is not |
| The notices             | The existing `StandingNotices`                                                                                                                                    |

## Scope and boundaries

- **Fidelity:** production. **Breadth:** both routes, both directions, every state, the answer and
  its refusals, the empty and failed states, the send confirmation, the redirect, the menu row, and
  `/my-profile`'s summary heading.
- **Untouched:** the domain and its projections; the two actions' bodies; the Worker's delivery
  email; the standing notices; the header's no-JavaScript fallback (#302). The one email change is
  the Hirer's Contact Exchange copy, whose button says _Ver tus propuestas enviadas_: it now links
  `/offers?box=sent`, the folder that button names.
- **Anti-goals:** no search, filter, sort or pagination at launch volume; no unread dot; no count on
  a folder; no colour that means hurry; no reply box, counter-offer, rating, resend, nudge, cancel
  or timer; no Offer open by default at `/offers`.

## States and ranges

| State               | What it shows                                                                                                                                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `empty`, no role    | Nothing either way: what arrives here and what is sent from here, a route into `/profiles`, and one into `/publish`                                                                                              |
| `empty`, received   | Nothing has reached her: what makes an Offer arrive, that a person reads each first, and a route to her profile — or to `/publish` if she has none                                                               |
| `loading`           | Row skeletons at a row's height, and the pane's on the detail route, so the heading does not move                                                                                                                |
| `partial`           | The heading painted; the lead, the count, the folders and the rows streaming off one read                                                                                                                        |
| `error`             | What failed, that retrying helps, and each side's sentence where the folder names the side — _Nada de lo que respondiste cambió_ / _Falló la carga, no el envío_ — and one that claims neither where it does not |
| `permission denied` | Signed out → `/sign-in` with a way back. At `/offers/<id>`, an Offer in neither of her lists → 404, returned                                                                                                     |
| `success`           | Answered → the result in the opened Offer, focused and announced. Sent → the three-clause confirmation on _Enviadas_                                                                                             |
| refused             | Answered already in another tab → she is told so, on the Offer that shows her answer. No longer hers to answer → an `alert` saying where the rest are                                                            |

**Ranges:** 0, 1, 5 and 40 rows per side; every state at least once; a 600-character work
description beside a 20-character one; a 60-character Hirer name and a `null` one; a Worker with a
103-character headline.

## Interaction and layout

`max-w-6xl`. **Phone:** one column — the heading block, the folders across the top, the list; an
opened Offer replaces all three. **`lg`:** twelve columns — folders (2), list (4), opened Offer
(6); with no folders, list (5) and Offer (7).

**Reading order:** heading → lead → waiting count → folders → the list → the opened Offer → the
standing notices.

**Keyboard and announcement:**

- Folders and rows are links in the tab order; the current folder and the opened row carry
  `aria-current`.
- Opening an Offer from a link focuses its heading, which also scrolls it into view on the phone.
  After an answer the result takes focus instead, so exactly one thing asks to be read.
- The list announces its count once when it resolves, not per row.
- The dialog opens on _Volver_ and returns focus to _Aceptar_ on close.

**Motion:** what the registry's dialog ships. Nothing else.

## Constraints

- **WCAG 2.2 AA.** Direction and state in words; every link names where it goes; focus visible; tap
  targets of at least 44 px.
- **NFR3's byte budget.** Re-measure `/offers` with `pnpm page-weight` and name the compression.
- **No spec identifier in any rendered string**, and every `id` on the page is unique.
- **Verified running** at seam 3 at 390 px and at `lg`, with and without JavaScript, with a
  before/after capture of the flow.
