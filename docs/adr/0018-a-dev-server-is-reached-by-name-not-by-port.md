---
status: proposed
---

# A dev server is reached by name, not by port

[ADR-0017](0017-work-is-written-in-a-worktree-and-merged-into-the-default-branch.md) made a worktree
the place work is written, and named what a worktree does not isolate. One item on that list has a
cost that grows with the number of sessions running at once:

> it shares the Docker database on 5432/6432 and **port 3000** with every other tree.

`apps/web/package.json` asked for `next dev --port 3000` exactly. So the second parallel session
either failed to start or drifted to 3001 silently, and `docs/agents/issue-tracker.md` dealt with it
by asking each session to prove ownership before trusting what it saw — read the PID out of
`apps/web/.next/dev/lock`, or settle it with `lsof -i :3000`. That is a verification step standing in
for an isolation mechanism, and it is the shape of thing that gets skipped on the session where it
would have mattered.

`next-dev-loop` inherits the same defect from the other side. Its own gotcha list says that when the
two views disagree, _"a stale or misdirected browser session is the likelier cause than a real
bug"_ — and the reason a browser session can be misdirected at all is that every tree answers on one
origin. A page from the wrong worktree is indistinguishable from a page from this one.

## The decision

**`pnpm dev` serves each worktree at its own HTTPS hostname, and the branch name is what
distinguishes them.** [portless](https://github.com/vercel-labs/portless) is a machine-wide proxy
that assigns an ephemeral port, injects it as `PORT`, and routes a named `.localhost` host to it. In
a linked worktree it prepends the branch name with no configuration at all:

```
https://web.recomencemos.localhost                 # the main checkout
https://124-add-widget.web.recomencemos.localhost  # ticket/124-add-widget
```

The name is derived from the branch, which ADR-0017 and `docs/policy/build.md` already require to
name its ticket. So the isolation costs no new convention — it reads one this repo already enforces.

Four parts:

1. **`apps/web/package.json`** runs `portless`, which runs `dev:app` (`next dev`, with no `--port`).
   `--port 3000` is deleted; the port is now the proxy's to choose.
2. **`authBaseUrl`** in `packages/domain/src/auth/config.ts` prefers the proxy's origin outside
   production. See below — this is the only application code the decision touches.
3. **`PORTLESS` is declared in `turbo.json`'s `globalPassThroughEnv`**, so the documented bypass
   works. See below.
4. **The proxy is installed once, by a human**, because binding 443 needs privilege an agent does not
   have and must not be given a way to ask for. `docs/runbooks/portless-setup.md` is the procedure.

## Why this is more than convenience

**Local development finally exercises the production cookie path.** `secureCookies()` in
`packages/domain/src/admin/challenge.ts` derives `Secure` from whether the base URL is `https://`,
and Better Auth derives its own `useSecureCookies` the same way — they must agree, because both are
written onto the same response. At `http://localhost:3000` both were **false** locally and **true**
in every deployed environment, so the attribute that decides whether a browser accepts a cookie was
the one attribute development never tested.

That divergence has already cost this repo a real bug, and the record of it is the comment above
`SIGN_IN_CHALLENGE_COOKIE_ATTRIBUTES`: the challenge cookie was **set** without `Secure` and
**cleared** with it, so browsers dropped the clear, and _"the challenge is spent on success"_ was
false for the whole ten-minute window. It was found by reading, not by running, because running it
locally could not have shown it.

HTTPS by default is therefore the second reason to adopt this and arguably the better one. The port
collision is a nuisance; a class of bug that development is structurally unable to reproduce is not.

## Why `authBaseUrl` exists, and why the guard is explicit

`BETTER_AUTH_URL` is the origin Better Auth is configured with, the origin it trusts, and the base
the magic link is built against — one variable, read once, so those three cannot drift apart. But the
proxied hostname carries the branch, so it is not knowable when `.env.local` is written and no static
value can be right for every worktree at once. The proxy writes the origin it is actually serving
into the child's environment; `authBaseUrl` reads that, and falls back to the configured variable.

**It ignores the proxy when `NODE_ENV` is `production`.** A deployed environment sets no such
variable, so the guard is redundant today — but "redundant today" is a claim about an environment
rather than a property of this code, and the failure it would prevent is silent: `trustedOrigins` and
every magic link pointing somewhere else, with nothing failing to make it visible. It is the same
shape `authSecret` uses to refuse the committed development secret and `responsibleParty()` uses to
refuse its placeholders, and it is cheap enough that its redundancy is not an argument against it.

Measured against the running app rather than reasoned about: with the proxy in front, a POST to the
magic-link endpoint carrying the `.env.local` origin is refused `403 INVALID_ORIGIN`, the same POST
carrying the proxied origin is accepted, and the link printed by the terminal transport is built
against the proxied origin.

## Why `PORTLESS` is declared in `turbo.json`

Because without it the documented escape hatch does not work, and fails **silently**. Turborepo runs
in `strict` environment mode, which filters an undeclared variable out of a task's environment
entirely — so `PORTLESS=0 pnpm dev` reaches `turbo`, and `turbo` drops it before `portless` ever
reads it. Measured with a throwaway task that printed the variable: undeclared it arrives as absent,
declared it arrives as `0`.

An escape hatch that is documented and does not work is worse than none, because the person using it
believes they took the other path.

## Alternatives rejected

**Keep `:3000` and keep proving ownership.** The status quo. It is a verification step where an
isolation mechanism belongs, and it leaves the HTTPS divergence above untouched.

**Give each worktree a fixed port.** No new dependency, but somebody has to allocate the numbers, the
allocation lives outside git or becomes a file every branch conflicts on, and every URL a session
quotes is then a number a reader has to map back to a branch. It also buys nothing on HTTPS.

**A high, unprivileged proxy port (`--port 8443`), so no human step is needed.** This works — it is
what the wiring was verified on, because an agent cannot answer a sudo prompt. It was rejected for
the steady state because the port returns to every URL, which is most of what this record is trying
to remove. The one-time `portless service install` moves the privilege to a moment a human is
present, and after it no agent meets sudo again.

**Fork `next-dev-loop` to teach it the new URL.** Refused by the root `CLAUDE.md`'s own rule: do not
fork a vendored skill for a small diff, put the coupling in an artifact this repo owns. The skill
already says to read the port off the banner and set `NEXT_MCP_URL` when it is not 3000; what it
needed was the value, and that is written in `CLAUDE.md` and `docs/agents/issue-tracker.md` instead.

## Consequences

**`pnpm dev` prints the URL, and that URL is the one to use.** It carries the branch, so a URL in a
PR comment or a session transcript says which tree produced it. `portless list` replaces
`lsof -i :3000` as the answer to "is this server mine".

**`next-dev-loop` addresses the two views at two addresses**, and this is a rule rather than a
preference. The browser goes to the proxied HTTPS URL, because that is the origin the cookies and the
CSRF check see and therefore the one worth testing. `/_next/mcp` is probed on
`http://127.0.0.1:$PORT`, which is the same process and the same MCP state, and which avoids handing
`curl` a private CA for no gain.

**The Google door is not reachable under the proxy.** Google will not register a `.localhost` HTTPS
redirect URI, and a branch-prefixed one would need registering per worktree. `PORTLESS=0 pnpm dev`
returns to `:3000` with the already-registered URI, which is the documented path for the session that
touches that door. The cost is bounded because the Google door is already optional locally — the
credentials are absent from `.env.example` by design, and CI runs without them.

**The database is still shared.** Two worktrees still write into one Postgres on 5432/6432. This
record halves ADR-0017's list and should not be read as clearing it.

**portless is pre-1.0** (`0.15.6`, pinned exactly as a `devDependency` so every worktree installs the
same one from the lockfile). Its state-directory format may change between releases, and a release
can require re-running `portless trust`. That is the same trade `docs/policy/build.md` accepted
knowingly for `gh stack` at v0.1.0, and the mitigation is the same: the failure is local, visible
immediately, and `PORTLESS=0` is a standing way back. Nothing in CI runs `dev`, so no pipeline
depends on it.
