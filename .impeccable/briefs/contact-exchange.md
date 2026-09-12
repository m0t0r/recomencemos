# Surface brief: the Contact Exchange

**Target:** her accepted row in the `/offers` ledger — `apps/web/app/(site)/offers/[id]/page.tsx`,
which is that ledger with one row open — and his accepted row at
`apps/web/app/(site)/sent-offers/page.tsx` · **Mode:** Operate · **Ticket:**
[#26](https://github.com/m0t0r/recomencemos/issues/26), story 9 · **Shaped:** 2026-09-12

**Built on [`received-offers.md`](received-offers.md)** (#271), which already says where this lands:
_an accepted row is where it lands; until then the row says La aceptaste._ The spec's target —
"the Contact Exchange is a state of that route, not a route of its own" — holds; the route is now
a ledger row rather than a page.

**Shape round, 2026-09-12**, three answers from the owner:

1. **He sees her details in his `/sent-offers` row**, in place. His email links there. No new route.
2. **Both copies by email go out before her screen loads**, so the row she lands on already says
   whether her copy was sent.
3. (Plumbing, recorded for completeness) each copy is keyed to its recipient, so the two sides'
   emails cannot collide.

## Job and audience

**Two people who have just agreed to talk, each reading the other's name, phone and email, on a
phone.** She has accepted and wants what she accepted in order to get; he has been told she accepted
and wants the same. Each will copy a number into WhatsApp or a dialler. Tone is the voice guide's
**Contact Exchange** row: Energy 2→3, Directness 5 — it names exactly what crossed, and it says the
email is a **copy** of what is on screen.

## Outcome and proof

**The primary thing to do:** read the other person's three details and leave the platform with them.

At 390 × 844:

| #   | Criterion                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------ |
| 1   | The other side's **name, phone and email** are on screen, as text, **once**                                              |
| 2   | What the reader **gave** is said once too — both sides' details, once                                                    |
| 3   | The screen says the email is **a copy** of what is here, and says it **before** anything about whether the mail went out |
| 4   | A failed copy leaves the details **on screen**, and says that is why they are there                                      |
| 5   | His name and number are said to be **his own claim**, beside them                                                        |
| 6   | Right after she accepts, **focus is on the exchange's heading** and the details are **announced politely**, once         |
| 7   | The standing notices — safety and no money — are on the page, at its foot                                                |
| 8   | Nobody who is not a party sees any of it; an Offer that is not hers is **the same 404** as a missing one                 |

**Product-specific truth.** Every other product ends this moment with a chat box, a rating prompt
or a "next step". This one ends it — principle 1, _introduce, then leave_ — so the last sentence the
platform says is that what follows is between the two of them.

## Selected direction

**`[settled]`:**

- **The details are text, never a `tel:` or `mailto:` link.** A link built from what a stranger
  typed is an `href` derived from user text (DD7, DD14). Copying is the reader's.
- **One component for both readers**, keyed on the side the domain decided. Copy differs; shape
  does not.
- **Where the copy by email stands, per reader and only for that reader**: sent, still sending,
  failed. Her copy's fate is not his to know.
- **The notices stay at the foot** of both pages, where #276 put them.
- **No chat, no rating, no "¿se hizo el trabajo?"** — the check-in is story 18, by email, at seven
  days.
- **Semantic tokens only, registry components only, light only. `noindex`, both halves.**

**Locked 2026-09-12: variant C, _Tarjeta de contacto_**, picked by the owner after flipping the three
on the real route at 390 px. A and B are on `prototype/26-variants`. Folded in with two changes the
owner asked for or the pick exposed: _Copiado_ goes back to _Copiar_ after two seconds rather than
sticking, and the phone is copied with its country code (`+57…`) while it is shown in the national
form — he may be anywhere, and a number without its prefix reaches nobody from abroad. His row at
`/sent-offers` takes the same card, and his terms fold under _Lo que propusiste_.

**`[open]` at shape time, each built as a variant on the real routes, behind `?variant=`:**

1. ~~How the accepted row turns into the exchange.~~ **C.** The UX-lab comment on #26 says _an
   accepted row turns into the Contact Exchange_. Three structurally different readings:
   - **A — _Encima de los términos_.** The row opens as today; the exchange sits at its top, above
     the terms it crossed for. The shut row is unchanged. (The tracer.)
   - **B — _La fila es el contacto_.** The shut row already shows his name and number in place of
     the first lines of the work — she comes back for a number, so the number is what the ledger
     shows; opening it shows the rest of the exchange, then the terms.
   - **C — _Tarjeta de contacto_.** The open row leads with a contact card: the three details large,
     one per line, each with a _Copiar_ control (an enhancement; the text is selectable without
     it), then the copy line, then the terms behind their own disclosure.
2. ~~Whether his row at `/sent-offers` follows the chosen variant.~~ **It does**, by the rule stated
   here before the pick.

## Scope and boundaries

- **Fidelity:** production. **Breadth:** both rows, every copy state, the arrival after accepting,
  a Hirer with no name or number.
- **Untouched:** the decision (dialog, equal weight, _Aceptar y dar mis datos_); the ledger's other
  states; the notices' wording.
- **Anti-goals:** no message box, no "llamar" or "WhatsApp" button built from a typed number, no
  rating, no follow-up prompt, no celebration.

## States and ranges

| State     | What it shows                                                                                          |
| --------- | ------------------------------------------------------------------------------------------------------ |
| `partial` | Details on screen, copy **still sending** — the row exists before the send has answered                |
| `error`   | Copy **failed**: the details are still here, and the line says that is why                             |
| `success` | Copy **sent**: the address it went to, and that it is only a copy                                      |
| denied    | Not a party → nothing: her ledger has no such row, his list has no such exchange; `/offers/<id>` → 404 |

**Ranges:** a 60-character name and a `null` one; a phone and a `null` one; a 60-character email.

## Interaction and layout

**Reading order, in an accepted row (variant C):** state sentence → the card (heading → the three
details, each with its _Copiar_ → the claim → the copy line → what the reader gave → the closing
sentence) → the terms, folded under _Lo que aceptaste_ or _Lo que propusiste_.

**Keyboard and announcement:** on the visit after accepting, the exchange's heading takes focus and
the details are announced through a polite live region — and the arrival sentence does not also take
focus. On every later visit, nothing moves.

## Constraints

- **WCAG 2.2 AA**; every `id` unique per row.
- **NFR4:** the details are in the server-rendered markup, so a phone with no JavaScript reads them.
- **NFR3's byte budget:** re-measure `/offers` with `pnpm page-weight`, and say the compression.
- **No spec identifier in any rendered string.**
