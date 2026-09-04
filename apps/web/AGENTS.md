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
