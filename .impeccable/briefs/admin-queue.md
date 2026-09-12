# Surface brief: the Admin queue

**Target:** `apps/web/app/(admin)/admin/` — one list across every source · **Mode:** Operate ·
**Ticket:** [#96](https://github.com/m0t0r/recomencemos/issues/96), amended by
[#277](https://github.com/m0t0r/recomencemos/issues/277) · **Shaped:** 2026-08-30 · **Amended:**
2026-09-12

**Amended with #277, and the reason is the comparison rather than a preference.** #96 shaped this
surface as five sections behind a sidebar, one route per concern, and recorded that variants could not
be drawn because no source had data yet. The sources arrived, and the UX lab (#178, idea 9, on
`prototype/ux-lab` at `f68ab0f`) drew three: **A — _La tabla_**, one dense list oldest first; **B —
_Una a la vez_**, a deck; **C — _Dos paneles_**. The owner chose A. What decided it is the failure the
old direction's third point already named: with five routes, **the oldest item can hide behind a
section nobody opened**, and the sidebar's counts existed only to mitigate that. One list, oldest first,
removes it instead of mitigating it.

**What the amendment keeps, because none of it was about the sidebar:** nothing is approved unread;
the count and the age-of-oldest are computed over each whole branch (C55); the 403 gate runs before
anything reveals what sources exist (NFR14); the four signals split by scope; every anti-goal below.

## Job and audience

**One unpaid operator, once or twice a day, at a desk.** Density over warmth (PRODUCT.md). They are
not exploring; they are clearing a backlog against a clock, and the clock is real: NFR7 gives every
Offer a 24-hour delivery band, and `unfreezeHirer` being an Admin action means a reported Hirer stays
frozen until this person acts.

Five kinds of pending work — Offers to read, photos to approve, Reports to resolve, Skill requests,
**bounced addresses** — and four signals that are **not** work: one about the platform (publish rate
above 10/hour) and three about a particular profile (a duplicate phone, more than 3 Reports filed in 7
days, more than 5 Contact Exchanges with distinct Hirers in 7 days).

**The failure mode this surface exists to prevent is an Offer nobody read.** Every decision below is
judged against that.

## Selected direction

**One list, every source, oldest first** — variant A of the UX lab, replacing #96's sidebar.

1. **One table at `/admin`, ordered by arrival across every source.** Each row shows its **source**, a
   one-line **summary**, and its **age** in hours. An old photo sits above a new Offer, which is the
   whole point: the order is the day's priority, and nothing has to be opened to find it.

   **The five per-source routes are removed, not kept as filters or deep links.** A link to one source
   is the hiding this direction removes. The 08:00 digest (#111) links `/admin`, where the oldest item
   already comes first. Narrowing is an **in-page filter** the Admin chooses — it opens on everything,
   says in the control when it is narrowed, and never changes the headline, which measures the whole
   queue.

2. **The headline is the page's one number.** The age of the oldest item anywhere and the count of
   what is waiting, both **over every whole branch** (C55), in the shell's header and in their own
   boundary, so they land before the list. It replaces the sidebar's five counts.

3. **The selected row opens in full, and its decisions exist only there.** The row renders exactly as
   each source's page did — the Offer's three fields, the photo, the Skill request's words — so nothing
   is approved unread. A closed row's decisions are **absent from the accessibility tree**, not merely
   hidden, so no key, tab or screen-reader path reaches a decision on an item nobody opened. The row
   just decided stays open saying what happened while the next one opens beside it.

4. **The keyboard is an accelerator; the buttons are the decisions.** `j`/`k` move and `a`/`r` press the
   open row's own buttons. WCAG 2.2 SC 2.1.4 is met by the _active only on focus_ route: the keys work
   only while focus is inside the list, and **never inside a field**. Offers and photos have a key map;
   **Skill requests have none** — promoting one means typing an identifier and a name, which no key can
   stand in for. Reports (unfreeze is a third decision) and bounced addresses decide their key map, or
   none, when their sources land.

5. **Signals split by scope, unchanged.** The publish-rate signal is about the platform and sits above
   the list. The three per-profile signals ride on the rows of the profile they concern. **A signal
   never becomes a queue item** and never carries an action.

6. **`/admin/sessions` stays a route of its own**, linked from the shell's header. It is a tool, not a
   backlog: nothing accumulates there, so it is never a row in the list.

## States

| State               | What it shows                                                                                                                                                                                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `empty`             | **A real and good state, and it must read as one.** Zero unreviewed Offers is the system working. The headline says the count is zero and the oldest-item age is zero, and the list says it again — never an illustration, never "nothing here yet".             |
| `loading`           | One skeleton for the list, labelled, at the rows' height. **One boundary rather than one per source**, and that is the cost of oldest-first: an order across every source cannot be drawn until every source has answered.                                       |
| `partial`           | **The headline resolves first**, in its own boundary, because it is the number that decides whether this person keeps working or stops. The list follows.                                                                                                        |
| `error`             | **Says which source failed**, by name, above the rows that did arrive. In one list this matters more than it did per section: the rows that loaded fill the screen, and nothing else would say a branch is missing. The rows that loaded stay usable.            |
| `permission_denied` | NFR14's 403 — returned, not redirected, one answer for every caller that is not an authenticated Admin. Lives at the shell, before anything reveals which sources exist.                                                                                         |
| `success`           | Per action. The decided row keeps its place and says what happened, the next row still waiting opens, and focus moves to the line an Admin reads on it — never to a control, never to the top of the page. A refusal leaves focus on the sentence explaining it. |

## Interaction and layout

**The shadcn data-table shape**: the registry's `table` for the markup, TanStack Table for the row
model, the source filter and which rows are expanded. Three columns — _Tipo_, _Qué espera_,
_Esperando_ — and the summary is the row's header cell and the control that opens it. Desktop may lead
here (the Admin works at a desk); **verify at 390 px anyway**, where the summary truncates and the
source column wraps rather than pushing the age off screen.

Rows are dense and scannable: a fixed row shape, the same decisions in the same position inside every
open row, and no per-row layout variation. Consistency here is worth more than expression — this
person sees these rows more than any other screen in the product.

**Keyboard path:** the header's link to the sessions tool, then the key hint and the filter, then the
list. Inside the list each row's summary is a button; opening a row puts its decisions next in the tab
order. The hint names the keys, where they work and where they do not, and is the list's accessible
description, so a screen-reader user entering it hears the order and the keys before the first row.

**Announcement:** an action's outcome is announced from the row that was decided, which stays open for
exactly that reason. The late marker is a word, not a colour.

**Cache Components:** the shell blocks on the gate (`export const instant = false` — a streamed shell is
a **200** on the wire before the gate answers, and NFR14 wants a 403). The headline and the list each
stream in their own boundary. **Nothing here is cached** (ADR-0011).

## Constraints a builder must not invent

- **`table` and `kbd` come from the registry**, with `@tanstack/react-table` for the model. The
  sidebar is gone from this surface; do not bring back a nav to hold counts the headline already
  carries.
- **Every string from a `_lib/messages.ts`**, under `docs/policy/voice.md`. Spanish labels, English
  routes and identifiers (ADR-0012).
- **No spec identifier in any string a person reads.** `NFR7`, `C24`, `story 7` go in comments.
- **Each branch is `LIMIT`-capped for display while its count and age-of-oldest are computed over the
  whole branch** (C55). When the caps hide rows the page says how many are shown out of how many wait.
- **A late marker follows the source's own band**, and only Offers have one (NFR7). Marking photos or
  Skill requests past 24 h would be inventing a band, which is a spec amendment.
- **Exactly four signals.** A fifth is a spec amendment, not a ticket.
- **Every Admin action re-checks authorization and writes an `AdminAction` in the same transaction**
  (C25). The page that rendered the form is not trusted by the action.
- Semantic tokens only; `noindex` inherited from `/admin/:path*`; WCAG 2.2 AA in every state above.

## Anti-goals

- **No dashboard.** No charts, no trend lines, no "this week" panel, no vanity counts. The headline's
  two figures and the four signals are the only non-row information on this surface.
- **No bulk approve, and no row selection that could become one.** Approving twenty Offers in one
  click is the mechanism by which an Offer reaches a Worker unread, and a human reading every Offer is
  a thing this product says publicly. The data table carries no checkbox column for this reason.
- **No sorting the Admin can change.** Oldest first is the design, not a default; a sortable age column
  is a way to put the oldest item back out of sight.
- **No badges implying suspicion.** A pending photo is described as under review, never flagged — the
  same rule PRODUCT.md fixes for the Worker's own view of it.
- **No notification bell, no unread state, no inbox metaphor.** The headline is the whole of it.
- **No colour-only urgency.** The marker carries text.
- **No page-load choreography, no empty-state illustration.** This person is entering a task.

## Open

- **Whether variant A's "flagged past 24 h" was meant for every source.** The build marks only Offers,
  because NFR7 states the one band and states it per Offer; the owner's answer decides whether that
  stays or a band is amended in for the other sources.
- **The Report and bounced-address rows**, and their key maps, arrive with their sources (#108, #110).
