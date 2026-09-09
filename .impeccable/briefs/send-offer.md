# Surface brief: the Offer form on `/profile/[slug]`

**Target:** `apps/web/app/(site)/profile/[slug]/` — the form and its two states · **Mode:**
Operate · **Ticket:** [#24](https://github.com/m0t0r/recomencemos/issues/24), story 6 ·
**Shaped:** 2026-09-08 · **Locked:** 2026-09-09, **variant C** ("un control, luego el panel") — three compositions
built and compared running at 390px; the losing two are in
[#237](https://github.com/m0t0r/recomencemos/pull/237)

**Mode is Operate, and it sits under a surface whose mode is Read.** `gated-profile.md` shaped
this route for comprehension: one person, understood well enough to decide whether to write to
her. This brief adds the writing. The two must not compete — a form that fights her page for
attention turns a person into a lead-capture surface, which is the failure this product's
principle 1 is about.

**Written from the spec, `PRODUCT.md`, `docs/policy/voice.md` and `DESIGN.md` with no answer
round.** Every decision below is marked `[settled]` where one of those settles it and `[open]`
where it is a composition question — and every `[open]` becomes a `?variant=` on the real route
rather than a question asked from a sketch.

## Job and audience

**A signed-in Hirer who has just read one person's profile, on a phone, anywhere in the
world.** He arrived from the Wall or from `/profiles`, has read her sentence and her work
history, and has decided he wants this particular person to do a particular thing. He is not
browsing any more.

He is **not the person this product's voice protects**, and the tone matrix says so: _Writing an
Offer_ is Warmth 5→3, Confidence 4→5. What he needs is not encouragement. It is to know, before
he types, that **a person reads this before she does** and that **he cannot change it
afterwards** — because both change what he writes.

The second reader is **her**, one remove away and not present. Everything he types is read by
her, in her language, on her phone, as a proposal about her week. That is the fact the form's
help text exists to keep in front of him.

## Outcome and proof

**The primary thing to understand, before he writes anything:** what he sends is what she
reads, unchanged, after a person has read it first.

**Success, stated so it can be measured rather than felt** — at 390 × 844, signed in, on a
profile with a 103-character headline:

| #   | Criterion                                                                                                                                    |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | The two facts — **a person reads it first**, **he cannot change it** — are on screen **before the first field**, not after the submit button |
| 2   | The form does not displace her identity: her portrait, name and sentence are still the first thing on the page                               |
| 3   | Three fields, each with a visible label and one line of help saying what the field is **for**                                                |
| 4   | On his **first** Offer, the two identity fields are present and labelled as **self-asserted**; on every later one they are absent            |
| 5   | A refusal names the fragment it objected to and **every field still holds what he typed**                                                    |
| 6   | The submit button says the verb of its action and names what happens — never _Enviar_                                                        |
| 7   | It works with JavaScript unavailable: a real `<form action>`, a `.stateAction()`, and no hidden input mirroring client state                 |

**Product-specific truth.** Every neighbouring product — a job board, a marketplace, a
messaging app — optimises this form for _volume_: send fast, send many, follow up. This one
does the opposite, and the inversion is the product. The delay is not a defect to apologise
for; it is the thing the platform actually does, and the copy says so in the present tense with
the actor visible (_una persona lee cada propuesta_), never in the passive.

**The anti-goal that matters most:** nothing here may read as a form for contacting a supplier.
She is a person deciding whether to spend her week on this.

## Selected direction

**Structural thesis: the promise comes before the fields, and the fields are three sentences he
would say out loud.**

The three things an Offer names — _the work, the pay, the when_ — are the story's own words and
they are the form's structure. Not a subject line, not a message body, not attachments: three
short fields, because a person answering has to be able to judge all three at a glance, and
because a free-form message is where a phone number goes.

**`[settled]` by the spec, `voice.md` or `DESIGN.md`, and out of scope for a variant:**

- **The two standing notices stay** where `gated-profile.md` put them, as `disclosure` at the
  foot. This form does not restate non-verification; it is one tap from it.
- **The immutability and the human review are stated before he writes** (tone matrix, _Writing
  an Offer_), and the confirmation says both again plus **that this usually takes under a day**.
- **No countdown, no urgency, no "N personas ya escribieron".** Energy 2, Optimism 3.
- **The identity fields are labelled self-asserted**, because they are, and because story 11's
  notice already tells her the same thing from the other side.
- **Semantic tokens only, registry components only, light only.** `field`, `input`, `label`,
  `button` and `card` all ship; nothing here is hand-rolled.
- **`sendOffer` is a `.stateAction()` and the slug is a bound argument**, never a hidden input
  (ADR-0015).

**`[open]`, and each becomes a variant:**

1. ~~Where the form lives.~~ **Behind a control**, so her page ends with an affordance rather
   than a task and stays a page about her. A native `<details>`, so it costs no JavaScript.
2. ~~How the promise is presented.~~ **On the control, and again at the submit.** Closed is the
   state he meets first, so it carries the human review and the window; the immutability is said
   again where the decision is actually taken, because a promise read once at the head of a
   panel is read too early to change what he writes.
3. ~~How the identity fields are grouped.~~ **Their own step, first**, fenced as a group.

**One flaw was found in the pick and closed in implementation.** Closed, C was a heading and a
sentence in a bordered box — nothing said it opened. The chevron and the two-column summary row
are what make it read as a control; without them the variant would have been judged on a defect
rather than on its idea.

## Scope and boundaries

- **Fidelity:** production.
- **Breadth:** the form, its help text, its refusals, its confirmation, and how it sits inside
  the page `gated-profile.md` already shaped.
- **Untouched, and each for a reason:**
  - **Her identity block, her sentence, her Skills and her work history.** #220 locked variant
    A and this ticket does not reopen it.
  - **The four route refusals, the ceiling, `noindex`, and the streaming boundary.**
  - **The standing notices' treatment**, decided on 2026-09-08 as `disclosure`.
- **Anti-goals:** no rich text, no attachments, no message thread, no templates, no "similar
  profiles" after sending, no rating of him, no counter of how many Offers she has, no progress
  bar over the review.

## States and ranges

| State               | What it shows                                                                                                                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `empty`             | The form as it first renders. Nothing is pre-filled but the two identity fields on a repeat sender, which are absent rather than filled.                                                                                        |
| `loading`           | Per-control, never a whole-form spinner. The submit control is busy and the fields stay readable.                                                                                                                               |
| `error`             | Per-field messages **and** a focused form-level summary. A contact detail names the fragment in guillemets and keeps everything typed.                                                                                          |
| `permission denied` | Signed out → `/sign-in` with a way back. Frozen or banned → he is told plainly, because the export already tells him the same thing. Blocked → he is told this person is not receiving Offers from him; see the decision below. |
| `rate limited`      | The seventh state: his count, when he may send again, and that the Offers already sent are on their way and nothing he typed was lost.                                                                                          |
| `success`           | The confirmation. **A person reads it first · usually under a day · he cannot change it**, plus a route into `/sent-offers`.                                                                                                    |

**Ranges, and every variant is judged against both ends.** `workDescription` 20–600 characters;
`payTerms` 3–120; `whenText` 3–120; `hirerName` 2–80; `hirerPhone` a Colombian or international
number. **Two fixtures:** a three-word pay term with a one-line description, and a 600-character
description with a 120-character pay term — a composition that only works at one end is not a
composition.

## The one decision this brief takes rather than defers

**What a Blocked sender is told: that this person is not receiving Offers from him, plainly, and
nothing about why or when.**

The alternative considered was the missing-profile response `/profile/[slug]` gives a frozen
caller (C22). It was rejected because the two cases are not alike. That page's refusal closes an
**enumeration oracle** — an unknown caller sweeping slugs — and a Block is downstream of an
interaction he was already part of. He can also catch the lie instantly: C3 keeps her card on
the public Wall and keeps his reading of her profile open, so a page that says she is gone while
she is visibly there is the kind of false a person notices, and `voice.md` Don't 4 refuses
exactly that softening.

What it does **not** say: that she Blocked him, when, or why. There is no reason field, no
appeal, and no wording that implies one. `CONTEXT.md`'s Block entry bans describing it as making
her invisible, and this copy does not.

## Interaction and layout

Single column, `max-w-3xl`, the phone first and the desktop the adaptation.

**Reading order:** her identity → her words → her Skills → her work history → **the promise** →
the form → the notices. Nothing about writing to her precedes reading about her.

**Keyboard and announcement:**

- Tab order follows visual order; every field is reachable and labelled.
- On a refusal, focus moves to the **form-level summary**, not the first bad field, so a
  screen-reader user hears how many things are wrong before being dropped into one — the rule
  the publishing form already follows.
- The confirmation is announced through a polite live region and takes focus at its heading.
- The submit control's busy state is announced, not only styled.

**No motion.** `motion-policy` is `UNSET` and nothing here needs a transition to earn.

## Constraints

- **WCAG 2.2 AA** (`docs/policy/ux.md` → `wcag-level`). Every field has a visible label; no
  error carried by colour alone; the fragment a refusal quotes is text, not a highlight.
- **NFR4.** The form posts without JavaScript. Verified by a native POST with an `Origin`
  header, not by reading the markup.
- **NFR3's byte budget.** Re-measure with `pnpm page-weight` rather than quoting a figure; the
  form adds this route's first client component.
- **No spec identifier in any rendered string.** The substance goes in the sentence, the
  citation in the comment above it.
- **Verified running** at seam 3 through `next-dev-loop`, with a before/after still pair as the
  recorded proof and a story demo, per this ticket's spec parent.
