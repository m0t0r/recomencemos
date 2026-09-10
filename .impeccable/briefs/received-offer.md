# Surface brief: `/offers/[id]`

**Target:** `apps/web/app/(site)/offers/[id]/page.tsx` · **Mode:** Decide · **Ticket:**
[#25](https://github.com/m0t0r/recomencemos/issues/25), story 8 · **Shaped:** 2026-09-10 ·
**Locked:** 2026-09-10, **variant A** ("diálogo encima") — three compositions built and compared
running at 390 px, each driven through its second step from the keyboard; the losing two are on
`prototype/25-variants`

**Written from the spec, `PRODUCT.md`, `docs/policy/voice.md` and `DESIGN.md` with no answer
round**, on the terms `sent-offers.md` set. Story 9 shapes this same route **after** acceptance —
the Contact Exchange is a state of this page, not a route of its own — so this brief stops at a
committed answer and leaves that state to its own brief.

## Job and audience

**A Worker deciding whether to give her contact details to somebody she has never met.** It is
the most consequential thing she does on this site, and it cannot be undone: once he has her
number, he has it. She may be reading on a borrowed phone, on mobile data, with the decision
mattering a great deal.

The story's own words are the brief: _the decision is mine, and it is made with everything in front
of me_. **"With everything in front of me" is the requirement, not a nicety** — the full terms are
on the page before the accept control is, because what she is agreeing to is what she can see.

## Outcome and proof

**The primary thing to understand:** exactly what she is being offered, and exactly what happens
if she says yes.

At 390 × 844:

| #   | Criterion                                                                                                                                                 |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | The **work, the pay and the when are rendered in full**, first, before anything else on the page has resolved                                             |
| 2   | The name he gave is here and is **said to be his claim**; the absence — _aquí no verificamos a nadie_ — comes first                                       |
| 3   | The accept and decline controls come **after** the terms in reading order, and **neither is visually preferred** — no default-highlighted Accept          |
| 4   | Accepting is **two steps**, the second **names what crosses in both directions** and **that it cannot be undone**, and both are reachable from a keyboard |
| 5   | Declining **is confirmed**, and the confirmation **stays** — reloading the page shows it declined, not a fresh Offer                                      |
| 6   | An answered or expired Offer shows its state in words and **no controls**                                                                                 |
| 7   | Nothing on the page is his phone or his email, or her own full name, phone or email — none has crossed                                                    |
| 8   | Somebody who is not the addressee gets **the same 404** an id naming nothing gets                                                                         |

**Product-specific truth.** Elsewhere a confirm step is friction to be minimised. Here it is the
one moment the product exists to get right — principle 2, _name the absence before the
reassurance_, applied to a button. Its second step reads like voice guide pair 4: _Si aceptas,
Carlos Restrepo recibe tu nombre completo, tu teléfono y tu correo. Tú recibes los suyos. Esto no se
puede deshacer: una vez que los tiene, ya los tiene._

## Selected direction

**Structural thesis: the Offer is a document, and the answer is at its foot.** She reads it top to
bottom the way she would read a note handed to her, and the decision sits where the reading ends.

**`[settled]`, and out of scope for a variant:**

- **Terms first, identity streaming.** The terms paint on the first flush behind a skeleton at the
  terms' height; the Hirer's declared identity arrives in its own boundary with skeleton rows holding
  its place (the spec's `partial` cell).
- **The confirmation names the fields**, not "your details": _tu nombre completo, tu teléfono y tu
  correo_, and his three the other way. Story 9 owns what the crossing then shows; this page owns
  that she was told before it happened.
- **The confirm button says the verb of the act** — _Aceptar y dar mis datos_, the voice guide's own
  example for an irreversible action. Never _Confirmar_, never _Sí_.
- **Equal weight.** Accept and decline carry the same button variant. Nudging her towards either is
  the platform deciding for her.
- **404 is one code path**, for a malformed id, an id naming nothing, an Offer not yet let through,
  one she Reported, and one addressed to somebody else — returned by the framework interrupt, never
  thrown.
- **No ceiling on accepting** (DD7): refusing a Worker the acceptance she waited for protects the
  wrong person.
- **Report and Block are story 10's**, and this page leaves them room rather than a stub.
- **Standing notices at the foot**, outside every boundary, so a failed read still shows them.
- **Semantic tokens only, registry components only, light only. `noindex`, both halves.**

**`[open]`, and each becomes a variant:**

1. ~~Where the second step lives.~~ **A dialog over the page.** `DESIGN.md` asks for inline
   alternatives to be exhausted before a modal, and they were: two were built and compared running.
   The dialog won because the second step is the one moment that should interrupt — it takes the
   whole screen for the one sentence that matters, and focus opens on _Volver_ rather than on the
   button that gives her details away.
2. ~~Whether declining asks first.~~ **No: one tap, confirmed afterwards.** Declining crosses nothing,
   so a second step would protect nothing — and the confirmation is the state line, which stays on
   every later visit.
3. ~~Where his name sits.~~ **Below the terms**, beside the decision it bears on. The terms are the
   Offer; the name is a claim about who wrote it.

## Scope and boundaries

- **Fidelity:** production.
- **Breadth:** the route in every received state, the two answers, the confirmation, the refusals an
  answer can meet.
- **Untouched:** the Contact Exchange (story 9), Report and Block (story 10), the delivery email.
- **Anti-goals:** no reply box, no counter-offer, no question to the Hirer, no rating, no "save for
  later", no timer.

## States and ranges

| State               | What it shows                                                                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `loading`           | A skeleton at the terms' height, then skeleton rows where his identity and the answer will be                                 |
| `partial`           | The terms rendered, his identity streaming                                                                                    |
| `error`             | The Offer failed to load: what failed, that retrying helps, and that her answer has not changed                               |
| `permission denied` | Not the addressee → **404**, returned. Signed out → `/sign-in` with a way back                                                |
| `success`           | **Accepted** → said plainly; what crosses is story 9's. **Declined** → confirmed, and it stays confirmed on every later visit |
| refused             | Answered already in another tab → she is told it is already answered, and the page shows what it is                           |

**Ranges:** a 600-character `workDescription` and a 20-character one; a `null` Hirer name; every
received state.

## Interaction and layout

Single column, `max-w-3xl`, the phone first; the answer within a thumb's reach on a phone.

**Reading order:** back to the list → heading → the terms → who sent it → the answer → the standing
notices.

**Keyboard and announcement:**

- The two-step confirmation is reachable and operable without a pointer; the second step names what
  crosses before its button is reached.
- Opening the second step moves focus to it; cancelling returns focus to the control that opened it.
- A committed answer is announced as a `status`, not an `alert` — it is the outcome of something she
  did.

**Motion:** only what the registry's own dialog or sheet ships, if a variant uses one.

## Constraints

- **WCAG 2.2 AA.** Focus is visible and trapped only where a dialog traps it; every control names its
  act.
- **NFR3's byte budget** — a dialog pulls Base UI's popup stack onto the route, which #160 took off
  every route's first load. Measure it with `pnpm page-weight` before choosing a variant that needs
  one.
- **No spec identifier in any rendered string.**
- **Verified running** at seam 3; **no before**, since the route does not exist on the default branch.
