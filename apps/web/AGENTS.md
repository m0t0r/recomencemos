<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## The design system comes first

Before writing any presentational element, read the inventory in
`packages/design-system/src/components/`. A component the registry lacks is added with
`pnpm dlx shadcn@latest add <component> -c packages/design-system`; hand-roll only what has no
registry equivalent. The root `REVIEW.md`'s registry-equivalents pass blocks a merge on a
hand-rolled equivalent of a component the registry already exports.

## Cache Components and the dev loop

**Cache Components is on.** `apps/web/next.config.ts` sets `cacheComponents: true`. Consequences you must design around, not work around:

- **Data is dynamic by default.** You opt _into_ caching with the `use cache` directive, `cacheLife`, and `cacheTag` — not out of it. The Next 15 route-segment config knobs (`export const revalidate`, `dynamic`) are the old model.
- **This flag _is_ Partial Prerendering.** `experimental.ppr` and `experimental_ppr` were removed in Next 16; `cacheComponents` makes PPR the App Router default, prerendering a static shell and streaming the dynamic parts in. Do not add a `ppr` flag.
- **Uncached data outside `<Suspense>` fails the build.** The error prints a labeled menu — `[stream]` (wrap in `<Suspense fallback={...}>`), `[cache]` (add `use cache`), `[block]` (`export const instant = false`). Pick deliberately and say which you picked; do not reach for `[block]` just to make the build green. The `Learn more` link under each error resolves to a page written for agents to read.
- **Node runtime only.** `export const runtime = 'edge'` is incompatible.
- `next build --debug-prerender` turns on server source maps and continues past the first failure when a minified production build error isn't enough to locate the cause.

`logging.browserToTerminal` is also on, so browser console errors and warnings appear in `next dev` stdout — check there before assuming a change works.

`apps/web`'s `check-types` runs `next typegen && tsc --noEmit` — the typegen step generates Next's route types first, so running bare `tsc` in that workspace can report spurious errors.

## A Server Action that changes what the header shows must call `refresh()`

The header lives in a layout, and **the App Router does not re-render a layout on a client
navigation inside its own subtree**. So every dynamic value the shell reads is fixed at document
load, and a Server Action that changes one leaves the header saying something that is no longer
true — on the page it redirects to, and on every page reached by clicking after that. Only a full
page load corrects it.

That is measured, not predicted (#171). Publishing a profile left the session menu offering
_Publica lo que sabes hacer_ directly above a page reading _Tu perfil ya está publicado_, while the
Wall underneath was correct at the same moment: a page segment re-renders and a layout does not.

```ts
import { refresh } from "next/cache";

// …the mutation…
refresh();
redirect("/my-profile?published=1");
```

**`refresh()` and not `revalidatePath`/`revalidateTag`, because there is no cache to invalidate.**
The shell's reads are uncached by design (ADR-0011 — a cached session read serves one person's
identity to the next), so a tag-based API has nothing to name and a path-based one would be reaching
for a server-cache mechanism to get at what is a client-router effect. `refresh()` refreshes the
client router, which is what re-runs the layout, and it may **only** be called from a Server Action —
not a Route Handler, not a Client Component.

**A cookie is the exception.** Next re-renders the current page automatically when a Server Action
sets or deletes a cookie through `cookies()` (the Server Actions guide under
`node_modules/next/dist/docs/` says so, and it was observed), so signing in or out already corrects
the shell without asking. `publishProfile` writes only to the database, which that mechanism cannot
see. The rule is owed by an action that changes a value the shell reads **and touches no cookie**.

Two further things this is not. It is **not** a licence to cache the shell: `refresh()` is the right
instrument here precisely because nothing is cached — and `revalidatePath("/account")` in the account
surface is not the thing to copy either, since that re-renders one page's own data rather than the
shell above every page. And it is **not** needed for the unhydrated path — without JavaScript a form
post is a document navigation and the layout re-renders anyway (NFR4), so this closes a gap that only
exists once the router is in play.

The rule and the observation behind it are in `app/_components/app-header/app-header.tsx`, beside
the reads they protect.

## Reading the log stream

`pnpm dev` pretty-prints log lines for a human. **`LOG_FORMAT=json pnpm dev` makes every line parse
with a bare `JSON.parse`**, which is what you want when you are counting lines or reading fields
rather than skimming:

```sh
LOG_FORMAT=json pnpm dev          # from the repo root; turbo passes both variables through
```

`LOG_LEVEL` moves the floor (`debug` in development, `info` in production) without a rebuild, and
`LOG_MAX_LINE_BYTES` moves the 8 KB line bound. All three are runtime-only, so none invalidates a
build.

`app/api/example-error/route.ts` is the worked example of both error paths, and its header comment
carries the two commands. Hitting it is how you check that a change to error handling still emits
what it should; the conventions it follows are in the root `CLAUDE.md`, under "Logging and errors".

**A long stack is trimmed, and the line says so.** `next dev` raises `Error.stackTraceLimit` to 50,
and under pnpm's store every frame is a ~250-byte path, so a development stack alone is ~12 KB. Every
stack on the line — the error's, and each link of its `cause` chain — shares **half the line bound
between them**, split by how many the chain carries, so a lone error keeps a deep stack and a chain
three deep still fits. Each is cut at a frame boundary, keeps the **leading** frames, and ends in
`... N frames omitted`. Everything else survives: the operator `message`, `context`, `code`, `status`
and the correlation fields.

Raise the bound when you are chasing a frame the trim dropped, and expect a much larger line:

```sh
LOG_MAX_LINE_BYTES=131072 LOG_FORMAT=json pnpm dev
```

The default is 8 KB in development **and** production, deliberately — local stdout is only worth
reading because it predicts what a drain will receive. A missing, non-numeric, or below-floor value
falls back to that default rather than failing the boot. See
[#48](https://github.com/m0t0r/ai-native-project/issues/48).

## Architecture of `app/`

Moved from the root `CLAUDE.md`; it binds only code under `apps/web`.

**A surface under `app/` is a folder, not a pile of files.** A route directory holds `page.tsx` and
`actions.ts` — the two things the framework and the network reach — and everything else sits in a
Next **private folder** (`_`-prefixed, so it is excluded from routing):

```
app/(site)/(auth)/sign-in/
  page.tsx                        # the route, and nothing else
  actions.ts                      # "use server"; one file, however many actions
  _components/{sign-in-form,google-mark}.tsx
  _lib/{schema,messages,use-sign-in}.ts
```

Route groups (`(auth)`) carry no URL segment and exist to group surfaces that share a shape. The
split is by **role**, not by kind: `_lib` holds what the surface knows (its schema, its Spanish, its
client machine) and `_components` holds what it renders. The flat twelve-file `app/sign-in/` this
replaced is the shape to avoid, and it is why `/code-review` should flag a route directory growing
past its two files plus two folders.

**Three groups sit at the top level, and they exist to separate audiences rather than shapes** (#17,
#103). `app/(site)/` is the public product — the Wall, `/sign-in`, `/account` — and its layout
renders `SiteHeader`. `app/(admin)/` is the moderation queue and its door, and its layout renders
none of that chrome: the session menu, the signed-in identity and _salir_ are built for a Worker on a
phone, and two of their parts would be actively wrong above `/admin`. The **root** layout is
therefore `<html>`, the fonts and one `<Toaster />`, and nothing else — a nested layout cannot remove
a parent's chrome, so the only way for `/admin` to have a shell of its own was for the root to stop
having one. No group adds a URL segment.

**`app/(token)/` is the third, and it exists because that same sentence applies one level down.** It
holds the routes under `/admin` that are reached with a **token and no session** — today
`/admin/enrol/[token]`. They cannot sit in `(admin)`: `AdminHeader` answers "am I signed in, as
whom, how do I leave", and on a page where no session exists yet all three are meaningless. Worse,
it renders a wordmark linking to the queue, which tells the holder of a setup link that a queue is
there and then walks them into a 403 — on a surface whose brief refuses to name `/admin` at all. That
was observed running, not predicted. A nested layout cannot remove a parent's chrome, so the route
moved out of the group rather than the group growing a conditional.

**`/admin/*` refuses with a real 403, and the mechanism is worth knowing before changing it.** NFR14
asks for _"403, returned, not a redirect and not a thrown error"_, and the three callers answer it
differently:

- A **page** calls `requireAdminPage()` from `lib/admin.ts`, which calls `forbidden()` —
  `experimental.authInterrupts` is on for this and nothing else. It is a framework interrupt of the
  same class as `redirect()`, so it costs no Sentry event, and it is the only way an App Router page
  can set a status code.
- A **Server Action** is built from `adminActionClient`, whose `use()` middleware returns a 403
  `ClientError` **before** the boundary parse. Written as a first line in each action body it ran
  _after_ validation, which seam 3 caught.
- **`/admin` is `export const instant = false`.** That is `[block]` from Cache Components' own menu,
  chosen because a streamed shell is a **200** already on the wire by the time the gate answers. The
  queue's sources still stream inside the page.

**Every route under `(admin)` calls the gate, and there is no allowlist to keep in agreement with
that.** `/admin/sign-in` was the one exemption and it was an exemption _by omission_ — a page that
simply did not make the call. It is deleted, and the shape it demonstrated is the one to keep: the
gate is a function each surface invokes, not a `proxy.ts` matching `/admin/:path*` with a carve-out,
because a carve-out is a second place the boundary is described and the first place a later route
falls on the wrong side of. `app/(token)/` is how a token-reached route stays outside the group
rather than becoming a hole inside it.

**Every Server Action is built from `apps/web/lib/safe-action.ts`.** That module holds
`actionClient`, the `handleServerError` bridge from `AppError` to the client envelope,
`returnActionError` for an expected refusal, and `rateLimit` — NFR26's ceilings as `useValidated`
middleware an action opts into by naming its principals. Three rules, all in
[ADR-0015](../../docs/adr/0015-both-doors-are-server-actions-and-the-browser-holds-no-auth-client.md):

- **`.stateAction()` + React's `useActionState`.** Never next-safe-action's `useStateAction` or
  `useAction` — the vendor's own form guide marks both as not working without JavaScript, which
  would put NFR4 out of reach.
- **`returnActionError` for an expected refusal; `throw` for the unexpected.** That is "thrown is
  reported; returned is logged" made structural — a thrown error reaches `handleServerError` and
  costs a Sentry event, a returned one bypasses it and costs one `warn` line.
- **Values that travel with a submit but are not typed into it are bound arguments**, not hidden
  inputs. `action.bind(null, returnPath, sharedDevice)` with `bindArgsSchemas` is typed, validated on
  arrival, encoded by React, and survives with JavaScript unavailable. A hidden `<input>` mirroring a
  piece of client state is the shape to replace.

**Inside `apps/web`, a cross-directory import is `@/`-prefixed.** `apps/web/tsconfig.json` maps `"@/*"` to `"./*"`, so `import { auth } from "@/lib/auth"` replaces `"../../../lib/auth"` — a specifier that changed every time a route moved, which is exactly what the `app/(auth)/sign-in/` folder move did to it. Next reads tsconfig `paths` natively and `apps/web/vitest.config.mts` already sets `resolve.tsconfigPaths`, so `tsc`, Turbopack and Vitest all resolve it with nothing further configured.
