# Surface brief: the Admin queue

**Target:** `apps/web/app/(admin)/admin/` — a shell plus five section routes · **Mode:** Operate ·
**Ticket:** [#96](https://github.com/m0t0r/recomencemos/issues/96) · **Shaped:** 2026-08-30

**Variants were not drawn, and the reason is recorded rather than implied** (#96's second acceptance
criterion). `QUEUE_SOURCES` is an empty array today: all five branches read tables that stories 3, 7,
8 and 10 create, so the shipped page renders its empty state and there is no density to draw against.
`/prototype` UI needs "real data and real density" in the spec's own words, so variants **defer to
[#31](https://github.com/m0t0r/recomencemos/issues/31)**, where the sources arrive. That argument
covers `/prototype` and does not cover this brief — a shape interview needs no data, which is exactly
why #96 was filed.

## Job and audience

**One unpaid operator, once or twice a day, at a desk.** Density over warmth (PRODUCT.md). They are
not exploring; they are clearing a backlog against a clock, and the clock is real: NFR7 gives every
Offer a 24-hour delivery band, and `unfreezeHirer` being an Admin action means a reported Hirer stays
frozen until this person acts.

Five kinds of pending work — Offers to read, photos to approve, Reports to resolve, Skill requests,
frozen Hirers — and four signals that are **not** work: one about the platform (publish rate above
10/hour) and three about a particular profile (a duplicate phone, more than 3 Reports filed in 7 days,
more than 5 Contact Exchanges with distinct Hirers in 7 days).

**The failure mode this surface exists to prevent is an Offer nobody read.** Every decision below is
judged against that.

## Selected direction

**Five sections behind a sidebar, one page per concern** — the structure chosen at shape, replacing
the single merged page the spec's contract described.

1. **A `sidebar` shell (shadcn) with five sections, and a route each.** Each section is independently
   buildable, which is the practical reason it won: **one ticket per section**, so story 7 stops being
   one large ticket and becomes five that can land in any order behind a shell that already works.
   Route segments are English per ADR-0012 — `/admin/offers`, `/admin/photos`, `/admin/reports`,
   `/admin/skills`, `/admin/hirers` — and the sidebar labels are Spanish.

2. **`/admin` redirects to `/admin/offers`.** Offers lead because they are the only source with a
   deadline attached: NFR7's band is per Offer, and a Report or a Skill request has no equivalent
   clock. **The gate runs before the redirect**, so an unauthenticated caller still meets NFR14's 403
   at `/admin` and never learns the five section routes exist.

3. **The sidebar carries the whole backlog, because nothing else can.** This is the direct consequence
   of choosing a redirect over an overview page, and it is a requirement rather than a decoration:
   with five routes and no landing screen, **the oldest Offer can hide behind a nav item nobody
   clicked**. So each section shows a **count**, and a section whose oldest item has passed its band
   shows an **urgency marker that is not carried by colour alone** (voice.md's accessibility rule, and
   WCAG 2.2 AA). The **age of the oldest item anywhere** sits in the shell, visible on every section
   page — the spec's UX table already asks for that figure to render first, and this is where it now
   lives.

4. **Act in place, with the full content rendered.** A page dedicated to one concern can afford to
   show each Offer in full, so nothing is approved unread and nothing navigates away. The reason to
   open a detail view was context a mixed list could not fit; a single-concern page fits it. No
   `/admin/offers/[id]`, no detail pane, no third column.

5. **Signals split by scope, which is what they actually are.** The publish-rate signal is about the
   platform, so it sits in the shell above the section content and is visible wherever you are. The
   three per-profile signals ride on the rows of the profile they concern, where the decision is made
   — a duplicate-phone warning at the top of the page while its profile is judged three hundred pixels
   below it is a warning that arrives in the wrong place. **A signal never becomes a queue item** and
   never carries an action; C24's own wording is that publishing is never refused and the queue simply
   says the rate is unusual.

## States

Per section, and the shell has its own.

| State               | What it shows                                                                                                                                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `empty`             | **A real and good state, and it must read as one.** Zero unreviewed Offers is the system working. It says the count is zero and the oldest-item age is zero — never an illustration, never "nothing here yet", never anything implying something is missing. |
| `loading`           | Skeleton rows at the row's height. Per section, inside its own `<Suspense>`, so a slow source never blocks a fast one.                                                                                                                                       |
| `partial`           | Some rows rendered, others streaming. **The oldest-item figure resolves first**, because it is the number that decides whether this person keeps working or stops.                                                                                           |
| `error`             | **Says which source failed**, by name. A silently missing source is an unreviewed Offer, which is the failure this whole surface exists to prevent. The other sections stay usable.                                                                          |
| `permission_denied` | NFR14's 403 — returned, not redirected, one answer for every caller that is not an authenticated Admin. Lives at the shell, so it covers all five routes with one gate.                                                                                      |
| `success`           | Per action. The item leaves its section, the count in the sidebar decrements, and focus returns to the queue position rather than to the top of the page.                                                                                                    |

## Interaction and layout

Sidebar left, content right, desktop-first (confirmed: the Admin works at a desk). The sidebar
collapses on a narrow viewport — `sidebar` handles that — and the shell's oldest-age figure must stay
visible when it does, because it is the one number that survives the collapse mattering.

Rows are dense and scannable: a fixed row shape per section, the same action affordances in the same
position every time, and no per-row layout variation. Consistency here is worth more than expression —
this person sees these rows more than any other screen in the product.

**Keyboard path:** the sidebar is a landmark and is skippable; the section heading is the first stop
in the content; rows are reachable in order and each row's actions are reachable from the row. After
an action resolves, focus returns to the **next** row rather than to the document, so twenty photos is
twenty keystrokes and not twenty re-orientations.

**Announcement:** each section's list is a live region for count changes, and an action's outcome is
announced — a row vanishing is not something a screen-reader user is told by default. The urgency
marker has a text equivalent, not just a colour.

**Cache Components:** the shell blocks on the gate (`export const instant = false`, for the reason
`/admin` already carries — a streamed shell is a **200** on the wire before the gate answers, and
NFR14 wants a 403). Section content streams inside its own boundary. **Nothing here is cached**
(ADR-0011).

## Constraints a builder must not invent

- **`sidebar` is not in the registry yet.** Add it with
  `pnpm dlx shadcn@latest add sidebar -c packages/design-system`; the `sidebar-*` tokens already exist
  in `globals.css`. Do not hand-roll it — that is exactly the review pass in `REVIEW.md`.
- **Every string from a `_lib/messages.ts`**, under `docs/policy/voice.md`. Spanish labels, English
  routes and identifiers (ADR-0012).
- **No spec identifier in any string a person reads.** `NFR7`, `C24`, `story 7` go in comments.
- **Each of the five branches is `LIMIT`-capped for display while its count and age-of-oldest are
  computed over the whole branch** (C55). The cap is a rendering concern; the numbers are not.
- **Exactly four signals.** A fifth is a spec amendment, not a ticket.
- **Every Admin action re-checks authorization and writes an `AdminAction` in the same transaction**
  (C25). The page that rendered the form is not trusted by the action.
- Semantic tokens only; `noindex` inherited from `/admin/:path*`; WCAG 2.2 AA in every state above.

## Anti-goals

- **No dashboard.** No charts, no trend lines, no "this week" panel, no vanity counts. The four
  signals are the only non-work information on this surface and there are exactly four of them.
- **No bulk approve.** Approving twenty Offers in one click is the mechanism by which an Offer reaches
  a Worker unread, and a human reading every Offer is a thing this product says publicly.
- **No badges implying suspicion.** A pending photo is described as under review, never flagged — the
  same rule PRODUCT.md fixes for the Worker's own view of it.
- **No notification bell, no unread state, no inbox metaphor.** The counts in the sidebar are the
  whole of it.
- **No colour-only urgency.** The marker carries text.
- **No page-load choreography, no empty-state illustration.** This person is entering a task.

## Open, and folded into #31 rather than settled here

- **The row shape per section**, which needs the real fields each source has — that is #31's data.
- **Whether the five sections keep separate `<Suspense>` boundaries once they are real routes**, since
  the original per-source boundaries were designed for one page holding all five.
- **Variants**, deferred to #31 as recorded at the top.
