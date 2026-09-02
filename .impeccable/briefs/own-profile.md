# Surface brief: `/my-profile`

**Target:** `apps/web/app/(site)/my-profile/page.tsx` · **Mode:** Operate · **Ticket:**
[#16](https://github.com/m0t0r/recomencemos/issues/16) · **Shaped:** 2026-09-02

**Shaped without an interview**, like [`publish.md`](publish.md): assumptions are marked
`[assumed]` and the open decisions are the human's.

## Job and audience

The same Worker, ten seconds after publishing, and again whenever she wonders "what are they
seeing". She arrives from the publish redirect, from the session menu, or by typing the URL. The
job is to answer one question with no ambiguity: **what is public, what is held, and what happens
to the held part**. Nobody else ever sees this page.

## Outcome and proof

**Primary thing to understand:** the split. Anyone sees her first name, last initial, city,
Skills and her one line. Whoever she accepts sees her full name and phone. Nothing here is a
promise the platform cannot keep, so the page says _held until you accept_ rather than _safe_.

**Product-specific truth:** the platform is telling her what it holds about her, field by field,
which is what the privacy notice promised and what a _consulta_ would have to answer. This page
**is** that answer, kept current.

**Success state on arrival from `/publish`:** one confirmation region, focused, saying the profile
is live and linking the Wall. The photo's absence is explained in one sentence, not badged.

## Selected direction

**Structural thesis `[assumed]`:** **show her the card a Hirer sees, then the rest, labelled by
who sees it.** The public card is rendered with the same component the Wall will use (or, until
story 4 lands, a card of the same shape), under a heading that says so. Below it, the gated
section (her one line in full, `about`, work history) under _Lo ve quien entre a tu perfil_, and
the held section (full name, phone) under _Lo ve solo quien tú aceptes_. Three tiers, three
headings, no badges, no icons standing in for words.

**Focal moment:** the public card. It is the thing she published; seeing it as a stranger would
is the proof the page exists to give.

**Implementation consequence:** the page reads `OwnProfile` — the gated shape plus her own
photo state — through one domain call, and renders it in one Server Component. There is no client
state on this page in this ticket.

## Scope and boundaries

- **Fidelity:** production.
- **Breadth:** the view, the arrival confirmation, and the two refusals. **No edit action** on
  this ticket — the spec's `success` cell ("edit saved") is the edit ticket's, and this page
  carries no form.
- **Untouched:** the photo (rendered as her initial with the one-line explanation), the public
  slug route (the "see it as they see it" link goes to the Wall, since `/profile/[slug]` is not
  built), Offers.
- **Anti-goals:** no "completeness" meter, no nudge to add a photo beyond the one sentence, no
  badge on the pending photo, no verification language.

## States and ranges

| State               | What it shows                                                                                                                                             |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `empty`             | n/a — a session with no profile is sent to `/publish` `[assumed]`, because that is the only useful thing to do with it and this page has nothing to show. |
| `loading`           | A skeleton at the card's shape and the two sections' heights.                                                                                             |
| `partial`           | Photo pending → her initial, described as under review in one sentence, never flagged. Not reachable on this ticket; the shape is designed for it.        |
| `error`             | Load failed: what failed, that a reload helps.                                                                                                            |
| `permission denied` | Signed out → `/sign-in?returnPath=/my-profile`. Not the owner → 404, **returned** as a framework interrupt, never a thrown `AppError` (C51).              |
| `success`           | Arrival with `?published=1`: the confirmation region, focused, with the Wall linked.                                                                      |

**Ranges:** one profile; 1–6 Skills; 0–5 work history lines.

## Interaction and layout

Single column, `max-w-xl` `[assumed]`, top-aligned. One `<h1>` naming the page as hers. Order:
confirmation (when arriving from publish) → public card under its heading → gated section →
held section → a short line saying where to go next (the Wall). Headings are `<h2>`s so a screen
reader's heading list reads as the three tiers.

**Keyboard path:** heading → confirmation (focused on arrival) → the Wall link → nothing else
interactive.

## Constraints and open decisions

- `noindex`, both halves: `/my-profile*` is on NFR8's list, so the header is already configured
  and the page sets `metadata.robots`.
- Semantic tokens only; registry components only; every string in `_lib/messages.ts` with the
  copy test beside it.

**Open decisions, for the human:**

1. **Three tiers as sections (above) versus a single field ledger** where every row carries who
   sees it. The ledger is denser and reads well on a phone; the tiers teach the rule better.
2. **Whether the signed-in-no-profile case redirects to `/publish`** (above) or renders a
   one-line page saying she has not published yet. A redirect is a page that cannot be linked to.
