# Runbook: the local dev proxy

The one-time, machine-level setup behind
[ADR-0018](../adr/0018-a-dev-server-is-reached-by-name-not-by-port.md) — after which `pnpm dev`
serves every worktree at its own HTTPS hostname and no session touches a port number again.

**It is here rather than in `CLAUDE.md` because an agent cannot do it.** Binding port 443 needs
privilege, and an agent that could ask for it would be an agent that could take it. Both steps below
are yours, they are run once per machine, and after them no session meets `sudo`.

| Pinned       | Value                                                  |
| ------------ | ------------------------------------------------------ |
| Date checked | **2026-09-04**                                         |
| `portless`   | **0.15.6** (exact, `apps/web` `devDependencies`)       |
| Node.js      | **24.11.0** (portless requires 24+, as does this repo) |
| Verified on  | macOS, darwin arm64                                    |

---

## 1. Trust the local CA

```sh
pnpm --filter web exec portless trust
```

Generates a local certificate authority and adds it to the OS trust store, so `https://…​.localhost`
carries no browser warning. Chrome and the `agent-browser` Chrome that `next-dev-loop` drives both
read the OS store, so this is the only place it has to be done.

It prompts for your password. Confirm with:

```sh
pnpm --filter web exec portless doctor
# ok    Local CA is trusted by the OS trust store.
```

## 2. Install the proxy as a startup service

```sh
pnpm --filter web exec portless service install
```

This is the step that makes the arrangement work unattended. The proxy binds **443**, which needs
privilege; installing it as a service moves that privilege to this moment, with you present, and the
daemon then starts at boot. Every later `pnpm dev` — in any worktree, by you or by an agent — finds a
running proxy and never elevates.

Confirm:

```sh
pnpm --filter web exec portless service status
pnpm --filter web exec portless doctor   # expect 0 failures, 0 warnings
```

## 3. Check one server end to end

From any worktree:

```sh
pnpm db:up
cp apps/web/.env.example apps/web/.env.local   # if this tree has none
pnpm dev --filter=web
```

`portless` prints the hostname it assigned before Next prints anything. In the main checkout it is
`https://web.recomencemos.localhost`; in a worktree the branch is prepended, so
`ticket/124-add-widget` serves at `https://124-add-widget.web.recomencemos.localhost`.

Two things are worth confirming the first time, because they are what the decision rests on:

```sh
# It serves, over HTTP/2, with a certificate the OS trusts.
curl -sS -o /dev/null -w '%{http_code} h%{http_version} verify=%{ssl_verify_result}\n' \
  https://web.recomencemos.localhost/

# Better Auth trusts the proxied origin and not the value in .env.local.
curl -sS -X POST https://web.recomencemos.localhost/api/auth/sign-in/magic-link \
  -H 'Content-Type: application/json' -H 'Origin: http://localhost:3000' \
  -d '{"email":"probe@example.test"}'
# expect: {"message":"Invalid origin","code":"INVALID_ORIGIN"}
```

The second is the interesting one. `authBaseUrl` in `packages/domain/src/auth/config.ts` adopts the
proxy's origin outside production, so `trustedOrigins`, the magic-link base and the `Secure` flag on
every cookie all follow the hostname the browser actually reached. A refusal there is the system
working.

---

## Living with it

| Situation                                   | What to do                                                                                                                         |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| "Which server is mine?"                     | `portless list` — routes by name, so the branch answers it. This replaced `lsof -i :3000`                                          |
| Testing the **Google sign-in door**         | `PORTLESS=0 pnpm dev`. Back on `:3000`, where the registered redirect URI works. Google will not register a `.localhost` URI       |
| Anything at all looks wrong                 | `portless doctor` first. It checks the Node version, the state directory, the proxy, OpenSSL and the trust store                   |
| Dev servers left behind by a killed session | `portless prune`                                                                                                                   |
| Safari, or a tool that bypasses system DNS  | `portless hosts sync`. Chrome and Firefox resolve `*.localhost` to loopback on their own; Safari does not                          |
| After a `portless` upgrade                  | `portless doctor`. The state-directory format may change between releases and `portless trust` may need re-running — it is pre-1.0 |
| A worktree is removed                       | Nothing. The route is per-branch and disappears with the server                                                                    |

**The database is not covered by any of this.** `docker-compose.yaml` still binds one Postgres on
5432 and one PgBouncer on 6432 for the whole machine, and every worktree writes into them. ADR-0018
halves ADR-0017's list of what a worktree does not isolate; it does not clear it.
