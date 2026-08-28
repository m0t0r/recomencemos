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

**`zod` is the schema library. The original claim about its cost was wrong, and is corrected here.**

This record first said: _"its cost here is close to zero: `better-auth` depends on it and
`better-auth/react` is a client import on `/sign-in`, so zod was already in the client bundle before
this decision was taken. Measured, not assumed."_ **That is false.** The full module graph reachable
from `better-auth/react`'s entry is fifteen files reaching four external packages —
`@better-fetch/fetch`, `defu`, `nanostores`, `react` — plus `@better-auth/core`'s `utils/string` and
`utils/url`, which import nothing at all. **No zod on any of those paths.** The original measurement
saw zod and `better-auth` in one chunk and attributed the first to the second; zod was there because
`sign-in-form.tsx` imports `./schema`, which is this decision's own doing.

So zod on the client is a **real cost this record chose**, not a free ride, and
[ADR-0015](0015-both-doors-are-server-actions-and-the-browser-holds-no-auth-client.md) has since
removed `better-auth/react` from the bundle without changing zod's presence at all — which is the
clean proof the two were never linked. As shipped it is one chunk of 385,265 B raw / 93,253 B gzipped
carrying zod among much else; the isolated figure is not separable from that build, so the honest
statement is that **the cost is unquantified and non-zero**, and NFR3's 120 KB budget on `/publish`
is where it has to be paid. The rest of this record's argument does not rest on the false claim —
but the paragraph below on `/publish` and the budget is now the one that decides, rather than a
formality.

### 2. The schema holds the rule; `messages.ts` holds the sentence

No Zod message reaches a person. Zod's own messages are English and are not under
[`docs/policy/voice.md`](../policy/voice.md), so a validator that returned `"Invalid email"` to a
Worker in Risaralda would fail the voice guide and NFR29 in one line.

**Clarified (2026-08-28): the schema may _carry_ the sentence, provided it imports it from the
surface's message module.** The first reading of this rule — schema maps to a field, surface supplies
the sentence — forced the client half to be a hand-written predicate restating the schema's regex,
because a schema whose messages could not be rendered could not be handed to a form library as a
validator. That predicate was a second copy of the rule, which is the exact failure part 1 exists to
prevent. `z.string().regex(EMAIL, EMAIL_LOOKS_WRONG)` where `EMAIL_LOOKS_WRONG` comes from
`messages.ts` satisfies the rule's intent exactly — nothing Zod authored is ever rendered — and it is
what lets the same object be the form's validator and the action's parse. `schema.test.ts` asserts
that every message a refusal can produce is the message module's.

### 3. The form layer owns fields, never submission

**`@tanstack/react-form`** owns field state, touched/blurred tracking, and client-side validation. It
does **not** own submitting: the `<form>` keeps its native `action={serverAction}` and its named
inputs, so a submit before hydration posts and the Server Action answers.

That constraint is not stylistic. **NFR4 is a `Must`**: _"With JavaScript unavailable or still
loading, a Worker completes every field except the photo and submitting produces a published
profile."_ A form abstraction that only works hydrated would put NFR4 out of reach, and it would do so
one ticket _after_ the one that chose it — which is the expensive moment to find out. `/sign-in` is
not itself bound by NFR4; it is where the pattern is set, so it is bound by it anyway.

**Since [ADR-0015](0015-both-doors-are-server-actions-and-the-browser-holds-no-auth-client.md) this
has a library-shaped form.** Actions are built with next-safe-action's `.stateAction()` and driven by
React's own `useActionState`; the vendor's `useStateAction` and `useAction` are forbidden, because
their own form guide marks both as not working without JavaScript. Same rule, obeyed in the idiom of
the library that now owns the server half.

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
  tree-shaking) and `zod` — the latter a genuine addition to the client bundle, not a free ride. See
  the correction above.
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
