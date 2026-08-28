# Surface brief: the signed-in shell

**Target:** `apps/web/app/_components/site-header/` · **Mode:** Operate · **Ticket:**
[#80](https://github.com/m0t0r/recomencemos/issues/80) · **Shaped:** 2026-08-28

## Job and audience

Not a destination. This is the one strip of chrome above every page, and it answers three questions
a signed-in person cannot currently ask anywhere: **am I signed in, as whom, and how do I leave.**

The person it is tuned for is NFR13's shared-device Worker — on a phone that is not hers, in a
cybercafé or a neighbour's kitchen, who has finished what she came to do and wants the session gone
now. The 8-hour shared-device row exists for her; until this ships, the only way to end that session
early is to type the URL of a page (`/account`, #13) that does not exist. A Hirer reads the same
strip; he is not who it is tuned for.

**Mobile-first, and that is a constraint rather than a preference.** Every measurement below is
taken at 360 px first and relaxed upward. She reads on a phone, often on mobile data, sometimes on a
borrowed one.

## What it can hold today, which is less than the ticket lists

Acceptance criterion 1 names `/account`, `/my-profile` and her received Offers as link targets. All
three are unbuilt — #13, story 2, story 8 — and the ticket says **link only what exists**. So the
first shell carries the identity and _Salir_, and it is the layout those three links hang on when
they land. Designing chrome for four destinations and shipping one is the failure this paragraph
exists to prevent.

## Selected direction

Four decisions taken at shape, each with the alternative it beat.

1. **Signed out, the shell offers _Entrar_.** Acceptance criterion 5 deferred this to shape, to be
   judged against story 4's Wall (#21) and story 11's standing notices (#22). It clears both: _Entrar_
   makes no claim about verification or money, so it gives neither notice a second source, and it sits
   in chrome rather than in the content region the Wall owns. It also settles criterion 6 —
   the header is the same height in both states, so nothing moves when a person crosses the boundary.
   It is suppressed on `/sign-in` itself, where it would point at the page you are already on.

   **It carries `primary` weight, not `outline`** _(2026-08-28, at the design lead's direction)_.
   Signed out, it is the only action the shell offers and the only thing in the row that is not the
   product's own name — so there is nothing for a primary weight to compete with, and an outline
   button reads as the secondary half of a pair that does not exist. One accent on a Restrained
   palette, on the one control (`DESIGN.md` → Colors).

   _Beat:_ brand-only, which leaves a Hirer reading a public profile no visible route to an account;
   and no shell at all when signed out, which makes the boundary a real shift.

2. **The trigger is the avatar alone; the address lives in the menu.** Prototype variant B, chosen
   at 360 px against the two alternatives below _(2026-08-28, the design lead's call)_.

   A 40 px circle, `Avatar size="lg"` rendered as the button itself rather than nested inside one —
   `Button size="icon"` is `size-9` with a rounded-**md** corner, so an avatar placed in it reads as a
   small circle floating in a square, which is exactly how the first draft went wrong. `rounded-full`
   and a matched size make the focus ring and the hover wash follow the avatar's own edge. 40 px is
   chosen for a thumb on a phone; WCAG 2.2 AA asks 24, so the floor is cleared with margin rather
   than met.

   Inside the menu, the **untruncated** address under _Entraste como_. That block is load-bearing
   rather than a courtesy heading: with this variant it is the only place the address is visible, so
   it wraps (`break-all`) rather than ellipsing — ellipsing it would defeat the one job it has.

   **What this trade costs, and it is a real cost.** DD5's borrowed-Android check — _"on a borrowed
   Android it may be the phone owner's"_ — stops being continuous. She taps once to see whose account
   she is in, where the earlier draft showed it always. What it buys is a control that never competes
   with the product name for room on a 360 px screen, and an address that is never rendered as
   `maria.rest…`, which is the form in which it answers nothing. A screen reader is unaffected: the
   trigger's accessible name carries the address in full at every width.

   _Beat:_ **A**, avatar + truncated address + chevron in one control — continuous but ellipsed, and
   it crowds the row at 360 px. **C**, no menu at all: address as text plus a standalone _Salir_,
   which is one tap instead of two and needs no `<noscript>` fallback — beaten because it has nowhere
   to put `/account`, `/my-profile` and her Offers, so #13 and stories 2 and 8 would each redesign
   this strip rather than add a menu row.

3. **The menu is the registry's `dropdown-menu`, and _Salir_ also works with JavaScript unavailable.**
   These two are in tension and both are kept, deliberately. `dropdown-menu` is the component the
   registry exports and the one every later menu in this product will be — #79 row 8 is the record of
   what hand-rolling an equivalent costs. But it cannot open without JavaScript, and criterion 3 is
   explicit that _"a `<form action>` posting to a Server Action is what makes salir work with
   JavaScript unavailable."_

   So there is **one form and one action, with two triggers on it**: the menu item, and a plain button
   revealed by a `<noscript>` rule. `<button form="…">` needs no ancestor form, so the fallback is a
   second _trigger_, never a second sign-out path — there is no duplicated logic to keep in agreement,
   which was the real objection to a fallback.

   _Beat:_ a native `<details>` disclosure, which works unhydrated with no fallback at all but is a
   hand-rolled equivalent of a component the registry already ships. The Popover API would solve it
   natively with neither cost and is **ruled out by NFR5**: Baseline since April 2024, which is about
   two months short of the 30-month Widely Available bar. Worth re-reading in late 2026.

4. **A `/prototype` round on the identity trigger, at 360 px.**

   _This reverses an earlier line in this brief, and the reversal is the record._ The first draft said
   no prototype was needed because the interview had closed every fork. That was wrong on its own
   terms: the interview settled _what the trigger contains_ and never settled _how it composes on a
   360 px phone_, which is the width mobile-first makes the deciding one. Three variants ran on the
   real `/` route with the real session read above them — one control with a menu, one icon control
   with a menu, and no menu at all — and the third exists to reopen decision 3, because a header with
   no menu needs no `<noscript>` fallback and no unhydrated dead window.

## The honest gap

`<noscript>` fires when JavaScript is **disabled**. It does not fire while JavaScript is **enabled but
not yet hydrated** — in that window the menu trigger is painted and inert, the fallback is hidden, and
_Salir_ is reachable by neither. It is a short window on a streamed response, and it is the price of
keeping the registry component; it is written here rather than discovered later.

## States

| State                   | What it shows                                                                                                                                                                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `signed_out`            | Product name, and _Entrar_. Nothing that implies a session.                                                                                                                                                                                                  |
| `signed_out_on_sign_in` | Product name alone. _Entrar_ is suppressed where it would link to the current page.                                                                                                                                                                          |
| `signed_in`             | Product name, and a 40 px avatar. The menu holds the untruncated address and _Salir_.                                                                                                                                                                        |
| `loading`               | The Suspense fallback: the header's exact height and gutter, and nothing in it. No skeleton bars — the only thing arriving is a 40 px avatar or a short link, and shimmer for that is theatre. The held height is what satisfies criterion 6 on first paint. |
| `signing_out`           | The menu item is busy; the header does not otherwise move. The redirect to `/` is the resolution.                                                                                                                                                            |
| `error`                 | Sign-out failed server-side. She stays where she is and is told the session is still open, in her terms.                                                                                                                                                     |

`empty`, `partial` and `permission denied` are `n/a`: chrome has no content of its own to be empty
or partial, and it is readable by everyone.

## Interaction and layout

A single row, full width, `border-b`, on `bg-background`. Height is fixed and identical in every
state — that fixed height **is** criterion 6. Product name left, session region right, nothing
between them.

**At 360 px** the name is the text `Recomencemos` at body size and the trigger is a 40 px avatar, so
the row never contends for width and nothing truncates at any breakpoint. Nothing collapses into a
hamburger — there is one control, and hiding one control behind another is the shape this brief
refuses.

**Sticky, and elevated once the page has moved under it** _(2026-08-28, the design lead's call;
this reverses an anti-goal below, and the reversal is the record)_. _Salir_ has to be reachable
without scrolling back to the top — criterion 1 asks for it within one interaction from any signed-in
page, and a header that has scrolled away costs a scroll first. Sticky does not cost criterion 6: a
`position: sticky` element still occupies its space in normal flow, so nothing below it reflows.

Two things a builder must get right, both learned the hard way here:

- **`position: sticky` goes on the `<header>` element itself, not a `<div>` inside it.** A sticky
  element travels only within its **parent's** box; nested one level down its parent is exactly as
  tall as it is, so it has nowhere to travel and scrolls away like any static element. It looks
  correct in the markup and does nothing.
- **The elevation is a sentinel plus `IntersectionObserver`, in a thin client wrapper.**
  `animation-timeline: scroll()` is this feature with no JavaScript and is ruled out by NFR5 — it
  reached the four engines between 2023 and 2025, short of the 30-month bar. The wrapper is the ring
  of a donut: it owns the `<header>`, the sentinel and one boolean, and every visible thing in the
  row is a Server Component passed through as `children`.

The shadow is `shadow-sm` and absent until earned. `DESIGN.md` reserves shadows for "things that
genuinely float", and a stuck header is floating over content passing beneath it — the rule is about
not faking depth on things that sit in the page.

**Keyboard path:** product name → _Entrar_ or the avatar trigger → (menu opens) → _Salir_. The
address block inside the menu is `aria-hidden`, because the trigger's accessible name already
announced it — so the first stop in the open menu is the action, not a repeat. The menu returns focus to its trigger on close, which is the registry component's own
behaviour. Signing out is a navigation, so the resolution is `/` rather than an announcement.

**No JavaScript:** the fallback _Salir_ is the visible control and submits the same form to the same
Server Action.

## Constraints a builder must not invent

- Every string comes from the surface's `messages.ts`, under `docs/policy/voice.md`. No copy is
  written at a render site. _Salir_ and _Entrar_ are the two words; neither is on a `CONTEXT.md`
  _Avoid_ list, both are the verb of their action, and both are one word — inside the guide's
  five-word bound for a control.
- Semantic tokens only — `bg-background`, `text-muted-foreground`, `border-border`. No colour value,
  no `dark:` override.
- Registry components only: `avatar`, `dropdown-menu`, `button`, `separator`. Nothing new is built.
  The avatar's size comes from the component's own `sm`/`default`/`lg` steps — a size outside them is
  a change to the design system, not a class on a call site.
- The session read is **dynamic** — no `use cache` around it (ADR-0011, and `apps/web/AGENTS.md`).
  The header therefore sits inside a `<Suspense>` boundary whose fallback holds its exact height.
- Better Auth is reached **only** through `@repo/domain/auth-handler` (ADR-0010). No browser holds an
  auth client and nothing imports `better-auth/react` (ADR-0015).
- WCAG 2.2 AA, `es-CO`, in the single light theme, including every state above.

## Anti-goals

No logo mark — there is not one yet, and inventing one here is a brand decision this ticket does not
own. No hamburger, no mega-menu, no notification bell, no search field, no theme toggle. Nothing in
this strip describes the person reading it. It is not a place the product speaks; it is a place she
orients and leaves.

_Sticky behaviour was on this list and was reversed above._ What stays refused is **scroll
choreography** — the header never changes height, hides on scroll down, reappears on scroll up, or
animates anything but the one shadow. A header that moves is a header she has to watch.
