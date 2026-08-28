---
status: proposed
---

# Both doors are Server Actions, and the browser holds no auth client

Story 1 shipped `/sign-in` with two doors built two different ways. The email door was a Server
Action behind a native `<form action>`. The Google door was `createAuthClient()` from
`better-auth/react`, called out of a click handler in a Client Component.

That asymmetry was inherited rather than chosen — DD5 gives `better-auth/react` to `apps/web` as its
own dependency, and the vendor's documentation shows the browser client because most products have
no Server Action to put in its place. This record replaces it: **every authentication call in this
product is made on the server, and no browser holds an auth client.**

## The rule

**`@repo/domain/auth-handler` is the only thing that talks to Better Auth, and only server code
calls it. A Client Component may hold a Server Action reference and nothing else.**

## What that bought, measured

`better-auth/react`'s full client graph is fifteen modules reaching four external packages:
`@better-fetch/fetch`, `defu`, `nanostores`, `react`, plus two zero-import leaves from
`@better-auth/core`. All of it was in the bundle a Worker downloaded to look at a sign-in page.

Measured across every chunk in `.next/static/chunks`, before and after:

|                                                 | before    | after         |
| ----------------------------------------------- | --------- | ------------- |
| chunks containing `better-auth`                 | 1         | **0**         |
| chunks containing `nanostores` / `better-fetch` | 1         | **0**         |
| that chunk, raw                                 | 417,671 B | **385,265 B** |

**The Google door also gained something it never had: it works with JavaScript unavailable.** It was
a click handler, so an unhydrated page showed a button that did nothing at all. It is a `<form>` with
a Server Action now, so it posts and redirects natively — which matters here because a Worker on a
slow connection meets the unhydrated page for real, not hypothetically.

**And it deleted a concept.** `SHARED_DEVICE_HEADER` existed because `/sign-in/social`'s request body
is a closed Zod schema that strips unknown keys, so the browser had nowhere to declare
_"este no es mi teléfono"_ except a header — which made the header's spelling a wire contract
`apps/web` had to pin with a test of its own (`shared-device-header.ts` and
`shared-device-header.test.ts`, both now deleted). `startGoogleSignIn` sets that header on a request
the domain package makes to itself, so it is internal to one hop and no caller can supply it.

## How the cookies get out

The one real obstacle. `auth.api.signInSocial` writes Better Auth's OAuth `state` cookie — and the
shared-device cookie beside it — onto the response of a call made _inside_ a Server Action, which
does not reach the browser on its own. Dropping them produces a `state_mismatch` at the provider's
callback.

**`returnHeaders: true`, and `apps/web` writes them.** The domain function returns
`{ url, setCookie }` and the action puts those on its own response through `next/headers`. Verified
against `better-auth@1.7.1`'s `dist/api/dispatch.mjs` rather than recalled.

**Better Auth's `nextCookies()` plugin was rejected**, and the reason is the package boundary: that
plugin does `import("next/headers.js")`, which would put a framework dependency inside
`@repo/domain`. The package binds nothing of Next's — `apps/web` binds the request handler to `GET`
and `POST`, and it binds the cookies the same way. Returning them keeps that consistent.

## Why `next-safe-action`, and what it is not allowed to own

Adopted for the server half of every action: one boundary parse, a composable middleware chain, and
one shape for what comes back. Story 1 hand-wrote all three, and eight later surfaces would each have
hand-written them again.

**`handleServerError` bridges to `AppError`; it does not replace it.** The library's convention is a
`serverError` of whatever that function returns, and this repo already has an answer for what a
browser may see — `ClientError`, the three-key whitelist in `@repo/errors`. So `apps/web/lib/safe-action.ts`
is where the two vocabularies meet, once, and the audience split ([ADR-0003](0003-no-tojson-on-cross-boundary-types.md),
[ADR-0005](0005-log-line-fields-are-named-for-the-line.md)) survives it: `message` is the operator's
and reaches the log line, `userMessage` is the only string that crosses.

**"Thrown is reported; returned is logged" is now a property of which function a handler calls.** An
error that reaches `handleServerError` was thrown, so it is unexpected and earns its Sentry event. An
expected refusal goes through `returnActionError`, which the library routes straight to `serverError`
without touching `handleServerError` — one `warn` line, no event. NFR26's second half stops being
something each handler has to remember.

**`useStateAction` is forbidden, and so is `useAction`.** next-safe-action's own form guide marks both
as not working without JavaScript and names React's `useActionState` as the one that does; the source
shows why, since both wrap the action in a client closure React can no longer encode into the form.
Every action here is therefore built with `.stateAction()` — a real server-action reference — and
driven by `useActionState`. This is [ADR-0014](0014-one-schema-parsed-twice-and-a-form-layer-that-survives-no-javascript.md)'s
third rule, obeyed in the library's own idiom.

**`@next-safe-action/adapter-better-auth` may not be used here.** Its signature is
`betterAuth<O>(auth: Auth<O>)` — it takes the Better Auth **instance** and calls `auth.api.getSession()`
on it. That instance is exactly what [ADR-0010](0010-the-domain-package-is-the-only-door-to-the-database.md)
withholds, so adopting the adapter means widening `@repo/domain`'s `exports` map and failing
`domain-boundary.test.ts`. Its whole body is eighteen lines and every one of them is satisfiable
through `AuthHandler.getSession`, which `apps/web` already holds. A later session reaching for it
because it is the documented path should read this paragraph instead. (It also calls `unauthorized()`
from `next/navigation`, which would require `experimental.authInterrupts` — a second reason, but not
the deciding one.)

**next-safe-action does not convert `FormData`** — checked against the installed package, whose `dist`
does not mention `FormData` at all. The documented answer is a `zod-form-data` dependency; a
`z.preprocess` on the one schema that needs it is the same conversion in four lines, and is what
ships.

## The cost, stated

- **One dependency** in `apps/web`, plus `@standard-schema/spec` as a dev dependency for the test
  matcher. Neither declares `engines`, satisfying NFR23.
- **A second error vocabulary exists in the type system**, even though only one reaches a person.
  `ActionError` is `ClientError` plus `retryAfter`, and the bridge is one function — but a reviewer
  now has two names for adjacent things.
- **The Google door's failure path is less immediate.** It used to fail in place, in the browser, with
  the button un-spinning. It now fails by redirect to `/sign-in?error=…`. That is the same path a
  provider-side failure already took, so the surface has one case instead of two — but it is a full
  navigation where there used to be none.

## Consequences

- No `apps/web` module may import `better-auth/react`, and `sign-in-form.test.tsx` asserts that over
  the source of the whole surface rather than leaving it to review.
- A later story needing an authenticated action writes a local middleware over
  `AuthHandler.getSession`, not the vendor adapter.
- Any new action is `.stateAction()` + `useActionState`. A pull request introducing `useStateAction`
  or `useAction` is a regression against this record and against NFR4.
