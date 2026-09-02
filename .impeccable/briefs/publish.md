# Surface brief: `/publish`

**Target:** `apps/web/app/(site)/publish/page.tsx` · **Mode:** Operate · **Ticket:**
[#16](https://github.com/m0t0r/recomencemos/issues/16) · **Shaped:** 2026-09-02

**Shaped without an interview.** The Build session ran unattended, so every answer below that a
discovery round would normally settle is an **assumption marked `[assumed]`** rather than a
confirmation. The spec's own UX table, the voice guide and ADR-0009 answered most of what an
interview would have asked; what they did not is listed under _Open decisions_ and is the human's
to correct before the surface is locked.

## Job and audience

A Worker in Pereira, Dosquebradas or Santa Rosa de Cabal, on her own or a borrowed Android, often
on mobile data, who signed in a minute ago and wants to be findable for paid work **today**. She
has nothing prepared — no CV, no photo picked out — and she is doing this in one sitting, possibly
standing up. Success is a published CapabilityProfile before she puts the phone down, and knowing
exactly which of the things she typed anyone can see.

The Hirer never reaches this page. Nothing here persuades; it is a form, and it is Operate.

## Outcome and proof

**Primary task:** fill eight things and press one button. Full name, first name, last initial,
city, Skills from the list, one line in her own words, her phone number, and the _autorización_.
Everything else — the longer self-description, work history — is optional and says so.

**The one thing she must understand before she types:** what is public and what is held. Her
first name, last initial, city, Skills and her one line are on the Wall for anyone. Her full name
and phone are collected now and shown to **nobody** until she accepts an Offer (C1, ADR-0009). The
form says this **beside the fields it applies to**, not in a preamble she scrolls past — a label
per group, in the voice guide's words: _Esto lo ve todo el mundo_ · _Esto solo lo ve quien tú
aceptes_.

**Product-specific truth a template could not claim:** the platform has already done the
protective thing — her phone does not leave here until she says so, and a person reads every
Offer before it reaches her. That is stated as fact beside the phone field, once, and it is the
whole reason a free-text field refuses a phone number: the refusal names the fragment and says
why in the same breath (NFR12, voice guide example 3).

## Selected direction

**Visual authority:** `DESIGN.md`, semantic tokens only, light only. Registry components
(`field`, `input`, `textarea`, `checkbox`, `button`, `card`, `skeleton`, `separator`, `alert`).
The Skill picker is product and lives here.

**Structural thesis `[assumed]`:** a **single page, three groups, one submit** — no wizard, no
steps, no progress bar. Three reasons, in order of weight:

1. NFR4 is a `Must`. A multi-step form either round-trips each step (a half-published profile
   between steps, which the one-transaction rule forbids) or holds steps client-side (which does
   not survive no JavaScript). One `<form>` posting one Server Action is the only shape that
   satisfies both.
2. One sitting, one submit. She should be able to see the whole of what is asked before starting,
   and to scroll back to fix one thing without losing the rest.
3. The group boundaries **are** the public/held boundary, so the layout teaches the disclosure
   rule without a paragraph about it.

**Sequence `[assumed]`:** the _autorización_ first — story 14 requires it above the first field,
and consent before collection is the requirement rather than a layout preference — then **what
she can do** (Skills, her one line), then **who she is** (first name, last initial, city, full
name), then **how to reach her** (phone), then the optional longer text and work history, then
the button. Capability before identity is the voice guide's own rule — _describe her by what she
can do_ — applied to field order.

**Focal moment:** the Skill picker. It is the largest control on the page, the one that most
describes her by capability, and the one that needs the most care on a phone: ~90 entries, so a
filter box for the hydrated case and a plain scrollable list of native checkboxes underneath it
for the unhydrated one. Chosen entries are echoed above the list so she never has to scroll to
count them.

**Implementation consequence:** every field is a **native control with a `name`**. The city is
three native radios, not a `Select` — Base UI's `Select` cannot be operated without JavaScript
and three options do not want a dropdown on a phone anyway. The consent checkbox is the registry's
(Base UI) and is operable unhydrated **through its label**, which is what `authorization.tsx`
already pairs it with; verified at seam 3 rather than assumed.

## Scope and boundaries

- **Fidelity:** production. This is the surface that ships.
- **Breadth:** the form, its seven states, and the arrival on `/my-profile` after success.
- **Untouched:** the photo (its own ticket; the form says so where the photo would be), the
  "not on the list" Skill request's _action_ (story 3's ticket; the option is rendered here and
  is keyboard-reachable, and it says what happens today), the public slug route, the Wall.
- **Anti-goals:** no wizard, no progress indicator, no autosave, no illustration, no "welcome",
  no sentence that describes her circumstances, no `Select`, no whole-form spinner, no modal, no
  character counters that read as a test she can fail (a limit is stated in the description and
  enforced by `maxLength`; the count appears only once she is within 20 of it `[assumed]`).

## States and ranges

The spec's Publish row plus the seventh state:

| State               | What it shows                                                                                                                                                                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `empty`             | The Skill picker before a query: the whole list, scrollable, with the filter box above it. Never a blank region and never "type to search".                                                                                                                        |
| `loading`           | Per field. The submit button is busy; nothing else greys out; every field stays readable and editable. No whole-form spinner.                                                                                                                                      |
| `partial`           | n/a on this ticket — the photo is what makes this state real, and it ships separately. The form renders the photo's place as a one-line note saying it comes after publishing.                                                                                     |
| `error`             | Per-field errors **and** a focused form-level summary listing every failed field by its label, each a link to the field. The contact-detail rejection names the fragment and keeps everything typed. A transport fault says what failed and that nothing was lost. |
| `permission denied` | Signed out → `/sign-in?returnPath=/publish`. Already has a profile → `/my-profile`. Both are redirects, not messages.                                                                                                                                              |
| `success`           | Redirect to `/my-profile?published=1`, which renders the confirmation — the profile is live, the Wall is linked, and the photo's absence is explained without a badge.                                                                                             |
| `rate limited`      | How many attempts today, when the window resets, and that nothing she typed was lost — voice guide example 2, verbatim in shape. The form stays on screen with her values.                                                                                         |

**Ranges `[assumed]`:** Skills 1–6 of ~90; headline 1 line, ≤ 120 characters; `about` 0–600;
work history 0–5 lines of ≤ 120; full name ≤ 80; first name ≤ 40; last initial exactly one
letter; phone a Colombian number in any of DD3's spacings, stored E.164.

## Interaction and layout

Single column, `max-w-xl` `[assumed]`, top-aligned (a form is not centred vertically — it grows).
One `<h1>`. Groups are `<fieldset>`s with a visible legend and a one-line description that says
who sees the group. Field help is one line saying what the field is _for_, never what it must
contain (tone matrix, Publish form row).

**Keyboard path:** heading → consent → Skill filter → Skill checkboxes (arrow keys move within the
list, space toggles) → "not on the list" → headline → first name → last initial → city radios →
full name → phone → about → work history lines → publish. Tab order is visual order.

**On submit failure:** focus moves to the form-level summary, which is `role="alert"` and says
how many things are wrong before listing them. Each item links to its field. The first bad field
is **not** focused — a screen-reader user hears the count first.

**On the rejector's refusal:** the field's error names the fragment in guillemets and the summary
carries the same sentence. Her text is untouched.

**Feedback lands above the button and below the last field `[assumed]`** — the summary is where
she is looking when she presses publish, and moving it to the top of a long form would put the
outcome a screen away from the control that produced it.

**No JavaScript:** the whole form posts. Every field is a native control with a `name`; the
Skill filter box is the one control that does nothing unhydrated, and it is hidden until
hydration so it cannot promise what it cannot do. Validation then happens once, on the server,
and the page re-renders with every value and every error.

## Constraints and open decisions

- Every string comes from `_lib/messages.ts`, under `docs/policy/voice.md`, with the copy test
  beside it. No copy at a render site.
- ADR-0014 and ADR-0015: one Zod schema parsed twice, TanStack Form on fields only, a
  `.stateAction()` driven by `useActionState`, no hidden inputs — the consent versions are bound
  arguments as `authorization.tsx` already prescribes.
- NFR3: ≤ 120 KB compressed JavaScript on first load, **measured** from `next build` and written
  in the PR. If Zod on the client is what breaks it, the client half of the schema goes, not the
  budget (ADR-0014's own consequence).
- WCAG 2.2 AA; `es-CO`; `noindex` is **not** required here (NFR8 does not list `/publish`) but
  the page has nothing a crawler wants, so it carries `robots: noindex` anyway `[assumed]`.

**Open decisions, for the human:**

1. **Group order** — capability before identity (above) versus identity first, which is the
   order every other form she has met uses. The prototype variants put both in front of you.
2. **Where the summary sits** — above the button (above) or at the top of the form.
3. **Whether `about` and work history belong on this page at all**, or on `/my-profile` as a
   second sitting. They are optional here; moving them would shorten the one-sitting form to
   exactly the ticket's eight things.
