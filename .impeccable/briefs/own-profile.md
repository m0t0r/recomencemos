# Surface brief: `/my-profile`

**Target:** `apps/web/app/(site)/my-profile/page.tsx` · **Mode:** Operate

| Ticket                                                   | Shaped     | What it settled                                                                                                                                                                                                                                                   |
| -------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [#16](https://github.com/m0t0r/recomencemos/issues/16)   | 2026-09-02 | The three tiers, locked as variant A (_Tres niveles_); the losers are on `prototype/16-ui-variants`                                                                                                                                                               |
| [#265](https://github.com/m0t0r/recomencemos/issues/265) | 2026-09-11 | Her Pause: the switch, the _en pausa_ state, and its ceiling's rate-limited state                                                                                                                                                                                 |
| [#275](https://github.com/m0t0r/recomencemos/issues/275) | 2026-09-11 | Her whole side on one page — variant A (_Una página_) of the UX lab's idea 7 at `f68ab0f`. **Locked 2026-09-12, variant A (_Una columna_)**, picked by the owner from three phone-first variants on the real route; B and C are on `prototype/275-phone-variants` |

**Reshaped for #265 and #275 without a discovery interview.** Both tickets carry their decisions,
and the one open question that was not layout — what _Cambiar la foto_ does — was put to the owner and
answered: **her photo is the Avatar, and tapping it (or a camera icon button, as on `/publish`)
changes it in place.** Assumptions are marked `[assumed]`; the layout questions are not asked here,
because they are what the variants exist to answer.

## Job and audience

The same Worker, but no longer only ten seconds after publishing. **#275's bet is that she opens this
once a day from a phone** and wants her whole side of the platform in one scroll, without knowing
where anything lives: _am I on the site, what do people see, has anyone written to me, what closed_.

The original job stands inside the new one: this page is still the answer to **what the platform
holds about her, and who sees which part** — the _consulta_ answered and kept current. #275 adds to
the page; it does not replace that answer.

## Outcome and proof

- **First glance:** whether she is on the site or _en pausa_, and since when — and how many Offers are
  waiting for her answer.
- **One tap each:** pause or resume; open the Offers waiting (`/offers`); change the photo; edit.
- **Proof the tap took:** the state line changes and a status region says so. A pause is never
  confirmed by a dialog — it is reversible, and a confirmation in front of a reversible act charges the
  person it protects for nothing.
- **Product-specific truth:** the sentence beside the switch names the two limits she needs before
  relying on it — **Offers already sent still reach her**, and **a pause cannot take back what
  someone has already read**. Nothing here says _ocultar_ or _retirar_.

## Selected direction

**Visual authority:** `DESIGN.md`'s ruled notebook, unchanged. Two inks, one paper; her words in
Alegreya, everything the platform wrote in Inter; state is a mark and a word, never a hue.

**Structural thesis (settled by #275, variant A):** her side, top to bottom, in this order —

1. **Where she stands.** One state line — _Tu perfil está en el muro…_ or _Tu perfil está en pausa
   desde…_ — and the Pause switch beside it, with the one sentence naming its two limits. **This is the
   focal moment.** The visible line carries no date: nothing records when a pause ended, and the date
   she published is not when she came back.
2. **Her card, as the Wall shows it.** The same `ProfileCard` a stranger sees. Her photo is an
   `Avatar` and **is the control to change it**, badged with a camera mark as on `/publish`; _Cambiar
   mi perfil_ goes to `/my-profile/edit`.
3. **The Offers waiting.** The count, a few rows (who says they are writing, one line of the work,
   when), and one link to `/offers` to read and answer. **A summary, not a second inbox**: nothing is
   decided here (#271 owns deciding).
4. **What closed.** One line per Offer she accepted, declined, or that expired.
5. **Who sees what** — #16's three tiers, **kept**, because they are the page's original answer and
   #275 adds to it. On a phone they stay open, below the Offers — what the owner picked in A.
6. Story 11's standing notices at the foot, unchanged.

**Locked on A, _Una columna_ (owner, 2026-09-12).** Everything stacked in the order above: the full
card in the first of #16's three sheets, rows for the Offers waiting, and all three sheets open. The two
that lost are on `prototype/275-phone-variants` — B, _Compacta_, which made the card one row and folded
the private tiers into `<details>`, and C, _Renglones_, one ruled ledger with no cards. **One fix the
variants surfaced:** mounted whole in the card's photo slot, the control's progress line rendered inside
the card's header and squeezed her headline, so the control is placed in two parts — the circle in the
card, its lines below it. Desktop is the adaptation.

**Implementation consequence:** the page reads `OwnProfile` (which now carries `pausedAt` and
`takenDown`) and `offers.listReceived` in parallel, inside the existing Suspense boundary. Two small
forms post `pauseProfile` / `resumeProfile`; the photo control is the one client island, and it is the
same upload pipeline `/publish` uses, attaching the photo as soon as the upload lands.

## Scope and boundaries

- **Fidelity:** production.
- **Adds:** the switch and its three states; the photo changed in place; the Offers summary; the
  closed lines.
- **Untouched:** `/offers` and `/offers/[id]` (#271); what the page _says_ while taken down (#28 —
  this ticket only hides the switch there); the deletion surface's pointer to pausing (#29); the
  public photo URL limit (DD8, a separate finding).
- **Leaves room for:** #33's seven-day check-in ask, which lands as one line between the state line
  and the card when it exists `[assumed]` — the ask is about an Offer that closed, and that is where
  she is already looking.
- **Anti-goals:** a confirmation dialog on pause; _ocultar_ or _retirar_; a completeness meter; a
  count styled as a metric (no red badge on the Offers waiting — a number of people who wrote to her
  is good news, not an alarm); deciding an Offer in place; a badge on a pending photo.

## States and ranges

| State               | What it shows                                                                                                                                                                                            |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `loading`           | A skeleton in the sections' shapes — state line, card, rows — so nothing moves when it resolves                                                                                                          |
| visible             | _Tu perfil está en el muro y cualquiera puede encontrarlo._, with no date; the switch reads _Pausar mi perfil_, off                                                                                      |
| **paused**          | _En pausa desde <fecha>_; the same switch, on, ends it. The limits sentence stays                                                                                                                        |
| taken down          | **The switch is not rendered.** What the page says instead is #28's                                                                                                                                      |
| **rate limited**    | The ceiling's own sentence — the count and when she may try again — then which state the profile is in now (_Tu perfil sigue en pausa_ / _sigue en el muro_), beside the switch, announced               |
| arrival             | `?published`, `?saved`, `?paused`, `?resumed`: one focused `role="status"` region, one sentence each. Only one can be true                                                                               |
| Offers waiting      | **0:** one sentence, still linking `/offers`. **1–many:** up to three rows `[assumed]` and a count that says all of them                                                                                 |
| Closed lines        | **0:** the section is absent `[assumed]` — an empty history is not a state to explain. **1–many:** newest first, one line each                                                                           |
| photo               | `absent` / `pending` / `approved` / `rejected` keep today's sentences; picking adds _preparing_, _uploading_, _ready_ and the upload's refusals                                                          |
| `error`             | Load failed: what failed and that a reload helps (`error.tsx`)                                                                                                                                           |
| `permission denied` | Signed out → `/sign-in?returnPath=/my-profile`; no profile → `/publish`; not the owner → 404                                                                                                             |
| no JavaScript       | Everything reads. **Pause and resume both work** — each is a form post and a redirect. The photo control says it needs JavaScript, in place of the control (NFR4's one exemption, `/publish`'s sentence) |

**Ranges:** one profile; 1–6 Skills; 0–5 work-history lines; Offers waiting 0–10 in practice (a
Hirer is capped at ten sends a day, and a person reviews each first); closed lines unbounded over
time, so the section shows the most recent few and links `/offers` for the rest `[assumed]`.

## Interaction and layout

- **Single column at 390 px.** `max-w-2xl` on desktop, as today.
- **Keyboard path:** `<h1>` → arrival status (focused when present) → the switch → the photo control →
  _Cambiar mi perfil_ → the Offers link → the tiers. The Offers rows are text, with one link for the
  section, so a keyboard user is not made to tab through each row to reach the next section
  `[assumed]`.
- **The switch is a real submit button inside a real form**, carrying `role="switch"` and
  `aria-checked` `[assumed]`. Base UI's `Switch` toggles in JavaScript and would do nothing unhydrated,
  so it can lend its look, not its behaviour. Which of the two endpoints the form posts to is decided
  by the current state, so a repeat tap is a no-op rather than an undo.
- **Announcement:** the arrival region says the new state after the redirect; the rate-limited
  sentence is announced where the switch is.
- Headings are `<h2>`s, so a screen reader's heading list reads the page's sections.

## Constraints and open decisions

- `noindex`, both halves, unchanged.
- Registry components: `Avatar`, `Alert`, `Button`, `Skeleton`, `Separator`; `Switch` for its look
  only. Semantic tokens only.
- Every string in `_lib/messages.ts` under `my-profile-copy.test.ts`; `docs/policy/voice.md` is the
  register. _Pausar mi perfil_, _en pausa_.
- No spec identifier in any string a person reads.

**Decided by the owner:** the phone composition — A, _Una columna_, picked from `/prototype` variants on the real route.
The agent builds them and does not choose.
