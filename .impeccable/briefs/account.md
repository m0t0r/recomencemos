# Surface brief: `/account`

**Target:** `apps/web/app/(site)/account/page.tsx` · **Mode:** Operate · **Ticket:**
[#13](https://github.com/m0t0r/recomencemos/issues/13) · **Shaped:** 2026-08-28 ·
**Amended:** 2026-09-07 for [#183](https://github.com/m0t0r/recomencemos/issues/183)

## Job and audience

A Worker who signed in somewhere she no longer controls — a cybercafé machine, a borrowed phone, a
computer at a relative's house — and wants that session gone without going back to the machine. She
is on her own phone, on a connection she pays for by the megabyte, and she may be here because she
is worried. She is not managing an account; she is closing a door she left open.

A Hirer reaches this surface too, with the same controls and the same copy. He is not who it is
tuned for.

**Mode is Operate.** Nobody wants to spend time here. Scanability and familiar affordances outrank
expression; the brand lives in the precision of the sentences.

## Outcome and proof

She leaves knowing two things she did not know when she arrived: **how many places her account is
open**, and that **the ones she does not recognise are now closed**. Success is one submit and one
sentence that quotes the number back at her.

The product-specific truth: this is the surface NFR13's shared-device promise resolves onto. The
8-hour session exists because a cybercafé browser may not close for a week — and this page is where
a Worker gets to not wait those 8 hours.

## Selected direction

Visual authority is `DESIGN.md` and the existing token layer; nothing new is introduced. Structure
is a **single column of stacked sections**, one per concern, because that is the shell later tickets
extend (email change, deletion) and a phone reads one column.

**Amended 2026-09-07 (#183): the column is a sheet on the ruled page, not a card on a grey field.**
`DESIGN.md` → The world had not been written when this surface was first shaped, and the composition
it describes is not open here — the ticket's own story states this family's answer, and `/my-profile`
and `/sign-in` have both shipped it. Four consequences, and each replaces something above rather than
sitting beside it:

- **Paper, at `/my-profile`'s measure.** The page is `background` with no card and no second ground.
  A card floating on `muted` is the idiom the world was chosen against, and it was the last one left
  in the product. These are the two signed-in personal surfaces, so they share a measure and the same
  `px-4 py-10` rhythm.
- **The list _is_ the ruled page.** Rows separated by the ruling, the rose margin line down the left
  from `sm` up and dropped on a phone — `DESIGN.md` → Layout, and the same `ruled-page` the Wall,
  Browse and the three tiers are drawn on. It replaces the registry's `Item` group, which draws a
  container this product's lists do not have.
- **The marker is the word and nothing else.** Decision 3 below put _Estás aquí_ in a `Badge`; a
  filled wash is a hue, and _state is a mark, never a hue_ names this surface directly — _a current
  session is a word_. The string, its position beside the device name and its place in the row's
  reading order are all unchanged; the chip around it is gone.
- **The outcome is a ruled note, not a boxed alert.** A mark in the left column — ink for the
  outcome, `destructive` for a limit of the platform — over a ruling, which is the shape `/sign-in`
  took at [#182](https://github.com/m0t0r/recomencemos/issues/182). Its live region is now permanent
  rather than mounted with its text, so what is announced exists before there is anything to announce.

**Every string on the surface, the one action and the one form are unchanged by this amendment**,
and so is everything decisions 1–5 below settle apart from the `Badge`.

Three decisions, each with the alternative it beat:

1. **The list is shown, and it is evidence rather than a control.** She reads what is open before
   she closes anything. Per-row close was considered and declined: it is a second domain method, a
   second Server Action and a second row in the authorization table, and the ticket's contract names
   one action. The list makes the tap informed without becoming a management console.

2. **One submit, no dialog and no inline confirmation step.** Closing a session is disruptive, not
   destructive — nothing is lost and anyone affected signs in again. Three reasons the dialog lost:
   a modal on a phone **covers the list she just read**, which is the one thing a confirmation must
   not do when the list is why the action feels safe; `deleteAccount` (#29) is the surface that is
   genuinely irreversible and spending the ceremony here would flatten the difference; and a
   `<dialog>` needs `showModal()`, so NFR4 requires the direct-submit path to exist anyway and the
   dialog would be a second path for one action. `DESIGN.md` says it independently — _"Don't reach
   for a modal first."_
   **The count in the button label is the confirmation**: she reads _Cerrar las otras 2_ directly
   under two rows she can see.

3. **The row treatment is A′, locked after `/prototype` UI on 2026-08-28.** Three variants ran on
   the real route against real session rows — A device-led and separated, B state-led and bordered,
   C field-labelled cards — and they live on `prototype/13-account-variants`. Two findings decided
   it, neither visible before the variants were rendered:
   - **B collapsed on ordinary data.** Leading each row with _"Abierta hace 6 días"_ reads well
     until every session was opened the same day, which is the common case; then all three rows
     lead _"Abierta hoy"_ and the primary line carries nothing.
   - **The task is recognition, so the device name must lead _every_ row.** She is hunting a
     machine she does not recognise, which makes the device name the scan column. A and B both
     broke that column on the first row — the one row that is not a candidate for closing — by
     making _Este aparato_ the heading. C kept the column but pushed the button below the fold on a
     phone, and a control out of sight is worse than an unlabelled value on a surface whose whole
     job is one action.

   **A′** is A's density with the device name leading every row and the marker as a word beside it.
   C's real gain — a screen reader announcing the field names — is available here through the
   description line at no vertical cost. (The marker was a `Badge` until #183; the word stayed and
   the chip went.)

4. **The control is `primary`, not `outline`.** It is the only action on the surface and the whole
   reason the page exists, and `DESIGN.md` gives `primary` to primary actions; nothing competes with
   it, so there is no hierarchy to solve by demoting it. `outline` on a white card read as tertiary
   on a phone. **Not `destructive`** — that follows from the same argument that removed the dialog,
   and spending it here would flatten the difference with `deleteAccount` (#29).

5. **The page teaches through the scene, never the term.** No definition of _sesión_ appears. The
   sentence names the situation she would recognise — a borrowed phone, a computer that is not hers
   — and the word is learned from its context. Voice guide Sophistication 2, and its rule against a
   sentence only someone who already knows the product can parse.

## Scope and boundaries

Production-ready, one route, one action.

**Untouched, because they belong to [#80](https://github.com/m0t0r/recomencemos/issues/80):** any
navigation or shell, the signed-in identity chrome, the link that reaches this page, and _salir_ —
single-session sign-out. **This ticket builds no second sign-out seam**, per #80's instruction.

**Anti-goals.** Not a security dashboard. No session count as a badge, no risk scoring, no
"unusual activity" language — this product adjudicates nothing, and a warning it cannot substantiate
is the kind of false a person relies on. No modal. No per-row control.

## States and ranges

The spec's surface table for Account, plus the ranges the list has to survive.

| State               | What it shows                                                                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `loading`           | Skeleton in the shape of the list — rows and the button — so nothing moves when it resolves. `Skeleton` from the registry, not a spinner                           |
| `only this session` | **The common case, and it must not read as a failure.** The list holds one row, _Este aparato_. The close-all control is absent, not disabled. A sentence says why |
| `loaded, 2–5 rows`  | The typical case. This device first, then the others newest-first                                                                                                  |
| `loaded, many rows` | No cap and no pagination — a person with 12 open sessions is exactly who needs to see 12. The list scrolls with the page                                           |
| `submitting`        | The one button is busy; the list stays readable and is not disabled. Per-action, per the spec's surface table                                                      |
| `success`           | The list re-reads and the confirmation names the count: _Cerramos 2 sesiones. Esta sigue abierta._ Announced, not merely rendered                                  |
| `action failed`     | What happened and what to do, in the same breath. The list is unchanged and still accurate, and the button is offered again                                        |
| `signed out`        | Redirect to `/sign-in`. This is the spec's empty state for this surface, and it is reached by an expired or revoked session, never by the action itself            |

**Row ranges to design against:** a session created minutes ago and one created 29 days ago; an
8-hour shared-device session that expires this evening; a session whose device string is absent
entirely (a crawler, a scripted client, a stripped `User-Agent`) — which must degrade to an honest
generic label rather than an empty row.

## Interaction and layout

- **Hierarchy.** Section heading → the one explanatory sentence → the list → the control. The
  control sits _after_ the evidence, never above it.
- **This device is first and is marked as itself**, so the row she cannot close is never a row she
  wonders about. The marker is a word, not a colour or a position — voice guide, and NFR20.
- **Keyboard path:** heading → the one button. The rows are static and not focusable; they are
  evidence, not controls. Focus stays on the button after the action resolves and the confirmation
  is associated with it, so a screen-reader user is told the outcome without hunting for it.
- **Announcement.** The confirmation is a live region. A list shrinking by two rows announces
  nothing on its own, which is the specific failure `DESIGN.md` names.
- **No JavaScript:** a `<form action={…}>` posting a `.stateAction()`. The page is fully functional
  — the list renders server-side and the button submits. This is NFR4, and it is why there is no
  dialog.
- **Motion:** none beyond the registry's own. Rows do not animate out; the list is re-read.
- **Responsive:** one column throughout. The row's second line wraps rather than truncating — a
  truncated device string is worse than a wrapped one.

## Constraints and open decisions

**Binding.** `es-CO` only, `tú` throughout. WCAG 2.2 AA. Buttons ≤ 5 words, body sentences ≤ 20.
`es-CO` date and time formats — _10 de agosto de 2026_, _3:40 p. m._ — never `08/10/2026`. Light
only.

**Registry components where the registry has the thing, and the product's own list idiom where it
does not** (amended #183). `Button`, `Skeleton` and `Separator` — the ruling — cover this surface and
nothing needs adding. `Card`, `Item` and `Alert` are deliberately absent: the first two draw a
container the ruled page replaces, and the third draws a box around a note that is now marked and
ruled. `profile-row.tsx` is the prior art for all three, and `REVIEW.md`'s registry-equivalents pass
is what this paragraph answers in advance.

**Two findings from Better Auth 1.7.1, read out of `dist/api/routes/session.mjs` rather than
recalled. Both change the implementation, and a builder must not rediscover them the hard way:**

1. **`/list-sessions` sits behind `freshSessionMiddleware`**, which throws `SESSION_NOT_FRESH` once
   the session is older than `freshAge` — **24 hours** by default. The Worker who signed in six days
   ago and wants to see her open sessions is _exactly_ who that gate refuses, so the endpoint cannot
   be the source for this list. Lowering `freshAge` globally is not the fix: the API contract gives
   `deleteAccount` "only from a **fresh** sign-in", so #29 depends on that gate staying strict.
   **The list is therefore read through a `@repo/domain` query**, projected field by field from a
   whitelist — which is also the only way the session `token` (classified `secret` at C28) stays off
   the wire. `/list-sessions` returns the whole row.
2. **`/revoke-other-sessions` sits behind `sensitiveSessionMiddleware`**, which has no freshness
   requirement and re-reads the session authoritatively with the cookie cache disabled. DD5 already
   has that cache off, so **revocation lag is zero, not bounded by a TTL** — which is the third
   acceptance criterion, answered by configuration rather than by a caveat in the PR body.

**The row shows device and time. Place was considered and dropped, 2026-08-28.**
The direction under consideration was device _and_ place (_Chrome en Windows · Pereira_). Turning a
stored IP into a city needs a geolocation provider, and that provider is a **fifth international
processor** in a consent notice the spec fixes at four (story 14) — while `analytics-consent` in
[`docs/policy/ux.md`](../../docs/policy/ux.md) is `UNSET`, which `CLAUDE.md` requires be raised by
name rather than answered inside a ticket. Fly sets no city header, so there was no free source
either. **Dropped by the repo owner** rather than deferred: the row is device and time, and the
`ipAddress` column is read by nothing on this surface.

Reopening it is a spec amendment, not a ticket — it needs a provider chosen, story 14's processor
list amended, and the policy key answered. Do not add it to this surface without all three.

**Device strings are resolved by a small pure function in `@repo/domain`, not a dependency.** The
label is cosmetic and its failure mode is a generic word, which does not justify a parser in the
dependency graph the `audit:direct` gate watches. It is a table over the common browser and platform
tokens, it lives at seam 1, and an unmatched `User-Agent` resolves to an honest generic label rather
than to a guess.

**What a builder must not invent:** the copy. Every string on this surface is written against
[`docs/policy/voice.md`](../../docs/policy/voice.md) and `CONTEXT.md`'s _Avoid_ lists — in
particular _usuario/a_ is banned, _sesión_ is permitted as the ordinary word it is, and no sentence
may describe her by anything that happened to her.
