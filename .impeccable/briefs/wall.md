# Surface brief: the Wall (`/`) and Browse (`/profiles`)

**Targets:** `apps/web/app/(site)/page.tsx`, `apps/web/app/(site)/profiles/page.tsx` · **Mode:**
Persuade for `/`, Operate for `/profiles` · **Ticket:**
[#21](https://github.com/m0t0r/recomencemos/issues/21) · **Shaped:** 2026-09-02 · **Locked:** 2026-09-02 — variant C's rows carrying variant B's chips, with B's opening cut to one primary action; the losers are on `prototype/21-ui-variants`

**Shaped without an interview, by decision.** The composition questions were about to be put as a
menu and the answer was _"I prefer seeing /prototype and decided visually"_. So the open decisions
below are marked `[open]` and become `?variant=` on the real route, against real data; everything
else is `[assumed]` from the spec, `PRODUCT.md` and [`voice.md`](../../docs/policy/voice.md).

**Amended 2026-09-04 with [#178](https://github.com/m0t0r/recomencemos/issues/178): the visual
world changed, the decisions above did not.** `/` now opens on **the cover** — the one region in the
product painted solid ink (`DESIGN.md` → The world) — carrying the proposition in the display face,
the same single primary action (hers), a link down to the profiles for him, and the platform's real
Skill vocabulary drifting slowly beneath. Under it the list is a **ruled page**: rows separated by
the ruling, a margin line down the left from `sm` up, her headline in Alegreya as the only line in
the display face, and a real seven-day count of new profiles when it is above zero. Then **how it
works**, as the three-step sequence it is, and a footer. Everything the table under "The decisions,
taken visually" settled — one primary, rows not cards, chips, the ordering named once over the list
on `/profiles` — survives; what changed is the world the page is drawn in. The vocabulary strip is
the product's one authored motion and stops under `prefers-reduced-motion`; `motion-policy` is still
`UNSET`, so that is a habit rather than a requirement. Story 11's notices keep their slot above the
list.

**Amended 2026-09-07 with [#184](https://github.com/m0t0r/recomencemos/issues/184): `/profiles`
takes the Wall's framing, and the framing is where the two were still saying different things.**
The amendment above put both surfaces in the same world, and the shared parts carried it — the same
row, the same ruling, the same margin line, the same one line of Alegreya. What did not travel was
the geometry _around_ the list, and that is what a reader actually arrives into: `/profiles` held
everything at `max-w-3xl` while `/` holds a wide column with the rows at a reading measure inside
it, so following _Ver todos los perfiles_ moved the whole ledger 128 px across a desktop screen.
Its one sentence over the list was a step larger than the Wall's and sat half the distance below the
heading, which on a phone is the difference between the first row being reachable and not.

So the section's measurements are now the Wall's `#profiles` section — the wide column with the rows
held at `max-w-3xl`, `gap-6` under the heading, `gap-8` over the rows, and the sentence in the working
face at the body step, where it was a step above it. **Three things are deliberately not copied**, and
they are named in the code beside where each sits rather than left to read as drift: `py-10` (the Wall
pads asymmetrically to clear the cover, and this page opens on the shell), `min-h-6` (the Wall's line
holds its box against a count that can be absent, and this sentence is never absent), and
`max-w-prose`, which is _added_ — `DESIGN.md` → Typography holds prose at 65–75ch, the Wall's line is
short enough never to reach the cap, and this one is 118 characters and would run to ~92ch without it.
**The structural thesis is unchanged and this is what it
was always claiming**: one card component, two orderings, two framings — where "two framings" means
two _sentences_, one for the newest and one for the whole ledger, and never two page shapes. A person's
identity should not depend on which list she was reached through, and neither should a reader's sense
of where he is standing.

Two things this deliberately did **not** touch. The **ordering sentence is the same string**, still
named once over the list and never on a card — changing it would be a copy decision this amendment
was not given, and the table below settled it. And the **paging link, the scroll enhancement and the
count announcement are untouched**: the accessibility tree is byte-identical before and after, which
is the proof that a change of framing changed no one's reading of the list.

One measurement the amendment does not take from the Wall: vertical rhythm. `/` opens on the cover
and pads asymmetrically beneath it (`pt-12 pb-4 sm:pt-16`); `/profiles` opens on the shell, so it
keeps `py-10`, the sheet rhythm `/sign-in` and `/publish` already use.

## Job and audience

**A Hirer with no account**, arriving cold — from a link someone sent him, from the news, from a
search. He is deciding one thing: **is there anyone here worth paying?** He has no reason yet to
trust this site and no account, and the spec deliberately refuses to ask him for one before he can
answer that question.

A **Worker** reaches the same two pages, for a different reason: to see whether this is real, and
to find the way to publish. She is on a phone, possibly borrowed, possibly on mobile data.

## Outcome and proof

**The primary thing he must understand:** these are real people who can do concrete work today, and
each one says in her own words what that is. Not a directory of categories — a list of capabilities
attached to faces and names.

**Success:** he reads three or four cards and forms a view. Nothing on either page asks him to
register, and nothing claims anyone has been checked.

**Product-specific truth, and it is the whole argument:** every card is somebody who published it
herself, in one sitting, from a phone. There is no curation, no ranking by merit, and no
verification — and `/profiles` orders **fewest delivered Offers first** so attention spreads rather
than piling onto whoever published most recently (NFR22). A neighbouring product could copy the grid;
it could not copy an ordering that deliberately works against its own most-engaged rows.

## Selected direction

**Structural thesis `[assumed]`:** one card component, two orderings, two framings. `/` is the
**newest** — what just happened, the page that rewards coming back. `/profiles` is **everyone**,
ordered so the least-contacted are met first. The card is identical on both, because a person's
identity should not depend on which list she was reached through.

**The card is the whole unit of information, and that is temporary but load-bearing `[assumed]`.**
`/profile/[slug]` is story 5 ([#23](https://github.com/m0t0r/recomencemos/issues/23)), which this
ticket blocks, so a card links nowhere yet. It therefore has to carry enough on its own — her one
line and her Skills, not a teaser for a page that does not exist. **A card is not a dead link in the
meantime**; it is not a link at all.

**Focal moment:** the first card's headline. Her own words are the only thing on either page that
nobody else could have written.

**Implementation consequence:** both pages are Server Components reading `PublicProfile[]` from
`@repo/domain/profiles`, one query each, Skills aggregated in that same query. No `use cache`
anywhere ([ADR-0011](../../docs/adr/0011-no-shared-cache-until-a-measurement-requires-one.md)) — so
each page has exactly one designed `<Suspense>` boundary, around the grid.

## The decisions, taken visually

The three open questions went to `/prototype` as `?variant=` on the real routes rather than to a
menu, and were answered by looking:

| Was open                | Answer                                                                                                                                                                                                    |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **The top of `/`**      | Title, subtitle, and **one primary action — hers**. A Hirer needs no button; the list below is what he came for. _Ver todos los perfiles_ stays under the list, so the opening holds one call and not two |
| **Density**             | **Rows, not cards** — variant C — because a card's padding and border cost about a third of a row's height and say nothing, and the reader is scanning for a capability                                   |
| **Skills**              | **Chips**, from variant B, rather than C's `·`-joined text. The recombination is the answer the prototype existed to produce                                                                              |
| **Naming the ordering** | Named, over the **list**: _"empezando por quienes todavía no han recibido ninguna propuesta"_                                                                                                             |

Naming the ordering per **card** would label an individual, which is the othering
[`voice.md`](../../docs/policy/voice.md) exists to prevent. It is said once, about the list.

**One thing outside the shell changed with it.** _Entrar_ in the header was primary weight on the
argument that nothing competed with it. The Wall's opening now does, so it dropped to a ghost link —
two primaries in one viewport is no primary at all, and the one that has to win is hers.

## Scope and boundaries

- **Fidelity:** production.
- **Breadth:** two routes, one card, one skeleton, the empty and error states of each, the count
  announcement, and keyset paging on `/profiles`.
- **Untouched:** the site header, `ProfileCard`'s existing use on `/my-profile` and `/publish`, the
  publish flow, `noindex` (neither route is gated — that is the point).
- **Anti-goals, each with an owner elsewhere:** **no standing notices** — they are story 11
  ([#22](https://github.com/m0t0r/recomencemos/issues/22)), and a half-version here would give them a
  second source; **no filters or search** — story 19
  ([#32](https://github.com/m0t0r/recomencemos/issues/32)); **no link to a full profile** — story 5;
  no counts of how many Offers anyone received, ever, on a public surface; no "destacado", and no
  ordering a visitor can change.

**Amended 2026-09-02: this list said "no infinite scroll", and it now has some.** That line was the
brief's, not the spec's, and it is overridden by decision. What the amendment preserves is the reason
behind it: paging is still a **link carrying the cursor**, server-rendered, and the scroll is an
enhancement over it — so the whole list stays reachable and indexable with JavaScript unavailable.
An infinite scroll that replaced the link would fail two of this ticket's own criteria.

**Virtualization was reviewed and declined, with a number.** `@tanstack/react-virtual@3.14.10`
declares no `engines`, so it is admissible — but the virtualizer measures a scroll element, so it
renders few or no rows on the server, which is exactly where indexability and the no-JavaScript path
live. And it buys nothing measurable here: with **600 published profiles all in the DOM**, a scroll
round-trip measured **45 ms against 50 ms at 24 rows**. It returns as an option the day a
measurement asks for it, which is [ADR-0011](../../docs/adr/0011-no-shared-cache-until-a-measurement-requires-one.md)'s
reasoning applied one layer up.

## States and ranges

Realistic ranges: **0** profiles before launch, **a few dozen** in the first week, **hundreds** at
the volume this spec was written for. One card carries 1–8 Skills, a headline of up to ~140
characters, a first name of 2–20 and one initial. No photo at all until the photo ticket lands, so
**every card renders its initial today** — which is also the pending and rejected state (one shape,
two causes, never a badge).

| State          | `/`                                                                                                 | `/profiles`                                                                                                                            |
| -------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `empty`        | The proposition and a route into `/publish`. **Never a blank region** — this is the pre-launch page | Distinct: names what is narrowing the list and offers to clear it; with no filter set, says the list is empty and routes to `/publish` |
| `loading`      | Card skeletons at the card's measured height, in the grid's own columns                             | The same skeletons; any framing above the grid renders immediately and does not move                                                   |
| `partial`      | Cards rendered, a photo slot still resolving → the initial                                          | Same                                                                                                                                   |
| `error`        | What failed, that retrying helps — **scoped to the grid**, so what sits above it survives           | Same, and the unfiltered list stays reachable                                                                                          |
| `denied`       | n/a — public                                                                                        | n/a — public                                                                                                                           |
| `success`      | n/a                                                                                                 | n/a                                                                                                                                    |
| `rate limited` | n/a — neither surface has a ceiling (NFR26 binds gated reads and actions, not the public lists)     | n/a                                                                                                                                    |

**The error state is scoped on purpose.** A route-level `error.tsx` would replace the whole page
including the notices story 11 puts above the grid — and the spec's own words for this cell are that
those notices still render. So the boundary sits **inside** the page, around the grid alone.

## Interaction and layout

- **Hierarchy:** framing (if any) → the notice slot story 11 will fill → the grid. The grid is the
  page; nothing above it may grow enough to push the first card below the fold on a phone.
- **Topology:** one column on a phone, two from `sm`, three from `lg`. Structural, not fluid.
- **The Suspense fallback holds the layout exactly** — same column count, same card height. A
  fallback of a different shape is a layout shift the brief just specified.
- **Announcement:** when the boundary resolves, the count is announced **once**, as a count
  (_"12 perfiles"_), through a polite live region. Never per card. With JavaScript unavailable
  nothing streams, so nothing needs announcing.
- **Paging on `/profiles`** is a plain link carrying the keyset cursor, so it works with JavaScript
  unavailable and a crawler can follow it. No infinite scroll and no page numbers — the ordering is
  keyset, and a page number would be a lie about a list that is rewritten daily.
- **Keyboard:** the grid is a list of non-interactive cards today, so the only tab stops are the
  header, the paging link, and whatever the chosen `/` variant puts above the grid. That changes with
  story 5, and the card is built so it can become a link without re-laying out.

## Constraints and open decisions a builder must not invent

- **Semantic tokens only. No colour value, no `dark:` override** — `theme-parity` is light only.
- **Registry components first:** `card`, `avatar`, `badge`, `skeleton`, `button` all already exist in
  `@repo/design-system`. `ProfileCard` is product and stays in `apps/web`.
- **WCAG 2.2 AA**, `es-CO`, `tú`-register, and the `CONTEXT.md` _Avoid_ list is binding — nobody on
  either page is named by what happened to them.
- **NFR3:** `/` and `/profiles` each ship ≤ 140 KB of gzip JavaScript on first load — counting every
  `<script>` the prerendered document requests and excluding the `noModule` polyfill bundle no
  browser inside NFR5's floor downloads. Amended 2026-09-03 with #157; the old ≤ 120 KB was set
  without measuring the framework floor, which is 81 KB on `/`. Anything added to this page is
  measured against that, not assumed to be free — and the figure names its compression, because the
  ambiguity cost 39 KB once.
- **NFR2:** p95 ≤ 400 ms server-side. One query per page, Skills aggregated into it; a query per card
  is the way this requirement is actually missed.
