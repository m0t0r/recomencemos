---
status: proposed
---

# One schema, parsed twice — and a form layer that survives no JavaScript

`/sign-in` is this product's **first form**, and eight more follow it: `/publish` with ten fields and
NFR12's contact-detail rejector, `sendOffer` with six, plus `requestSkill`, `changeEmail`,
`acceptOffer`'s two-step confirmation, `reportOffer`, `deleteAccount`, and the Admin's eleven
actions. The spec fixes what a Server Action owes — _"it authorizes, **parses its input once at the
boundary**, and calls one domain module"_ — and DD2 fixes what that parse owes a person: _"the
boundary parse produces `fieldErrors` for a person; a `CHECK` is a backstop that must never fire."_

**What the spec never says is how.** No validation library is named, no form library is named, and
nothing says whether the browser is allowed to know the rules the server enforces. Left unanswered,
the first three form tickets would each answer it differently, and the fourth would inherit three
conventions.

This record answers it. It was taken at Build time on [#12](https://github.com/m0t0r/recomencemos/issues/12)
rather than at Design, which is worth naming as a deviation: the spec is the authority on _what_ gets
built, and this is a _how_ that turned out to set precedent for nine surfaces.

## The rule

**One schema per action, in a module both sides import. The server parses authoritatively; the
browser parses the same schema as a courtesy. The form layer owns field state and never owns
submission.**

Three parts, each with a failure it exists to prevent.

### 1. The schema is shared, and the server's parse is not optional

A Server Action is compiled to a **directly reachable POST endpoint**, so a rule enforced only in the
browser is not enforced. The client check exists to save a round trip on a connection that may be
slow and metered — deleting it costs latency; deleting the server's costs the rule.

Sharing the schema is what stops the two drifting into disagreement, which is the failure that
produces a field the browser accepts and the server silently rejects.

**`zod` is the schema library, and its cost here is close to zero**: `better-auth` depends on it and
`better-auth/react` is a client import on `/sign-in`, so zod was already in the client bundle before
this decision was taken. Measured, not assumed.

### 2. The schema holds the rule; `messages.ts` holds the sentence

No Zod message reaches a person. Zod's own messages are English and are not under
[`docs/policy/voice.md`](../policy/voice.md), so the schema maps to a **field**, and the surface's
message module supplies the sentence. A validator that returned `"Invalid email"` to a Worker in
Risaralda would fail the voice guide and NFR29 in one line.

### 3. The form layer owns fields, never submission

**`@tanstack/react-form`** owns field state, touched/blurred tracking, and client-side validation. It
does **not** own submitting: the `<form>` keeps its native `action={serverAction}` and its named
inputs, so a submit before hydration posts and the Server Action answers.

That constraint is not stylistic. **NFR4 is a `Must`**: _"With JavaScript unavailable or still
loading, a Worker completes every field except the photo and submitting produces a published
profile."_ A form abstraction that only works hydrated would put NFR4 out of reach, and it would do so
one ticket _after_ the one that chose it — which is the expensive moment to find out. `/sign-in` is
not itself bound by NFR4; it is where the pattern is set, so it is bound by it anyway.

The corollary: **an action's outcomes are not form state.** `rate_limited` carries a `retryAfter`,
`sent` is a success that deliberately keeps the form, and `failed` is a transport problem. None is a
field error. They stay in a `useActionState` union, which is why
`@tanstack/react-form-nextjs`'s `mergeForm`/`useTransform` path is deliberately unused — folding those
into one form state would flatten distinctions NFR26 and the spec's surface table depend on.

## What was rejected

**No library at all** — native `type="email" required` plus the server parse. It is the simplest
thing and it very nearly won: zero bytes, works unhydrated by construction. It loses on two counts.
The browser's validation message is the browser's, in the browser's words, and is not under the voice
guide. And it does not survive `/publish`: ten fields with cross-field rules and a form-level error
summary that focus moves to (the spec's **Keyboard and announcement** section requires exactly that)
is where hand-rolled form state stops being cheaper than a library.

**A form library that owns submission** — the conventional `handleSubmit` + `fetch` shape. Rejected
for NFR4, above.

**Zod on the server only.** Cheapest correct option, and it is what shipped first. It leaves her
learning about a typo one network round trip later, on the connection least able to afford it, for a
saving that is now measured at approximately nothing.

## The cost, stated

- **Two dependencies** in `apps/web`: `@tanstack/react-form` (~3 KB gzipped, whole dist before
  tree-shaking) and `zod` (already present transitively via `better-auth`).
- **A form abstraction on a one-field form is over-engineering on that surface**, and the simplicity
  lens is right to say so. Its justification is entirely stories 2 and 6; if those land without
  needing it, this record should be revisited rather than defended.
- Both declare no `engines`, satisfying NFR23.

## Consequences

- Every later form ticket adds a `schema.ts` beside its action and imports it from both sides.
- A form whose submit path stops working with JavaScript disabled is a regression against this
  record, not a detail — `sign-in-form.test.tsx` asserts the native `action` and the named inputs for
  that reason.
- If `/publish` cannot meet NFR3's 120 KB budget with this layer in it, the layer goes, not the
  budget.
