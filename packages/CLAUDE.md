# packages/

How the packages guard their boundaries and how they import internally. The rules that bind code
_importing_ these packages — `@repo/errors` stays dependency-free, `@repo/observability` never reaches
a Client Component, `@repo/domain` is the only door to the database — stay in the root `CLAUDE.md`.

**Where a server value has to reach it, the value crosses and the module does not** ([ADR-0016](../docs/adr/0016-one-request-id-per-request-adopted-not-minted-per-error.md)). `AppError.requestId` is the current request's id, adopted through the `globalThis` slot in `packages/errors/src/ambient-request-id.ts`, which `@repo/observability`'s `request-context.ts` is the only thing that writes to. It is per-**request**, not per-error: two failures in one request quote one reference number, and the error line joins the completion line. The mitigation is unchanged — there is still no constructor option, so nothing an inbound header carries can reach it — and every way the reader can misbehave costs the adoption rather than the error. Copy the shape only for a value; a _module_ @repo/errors needs is still the signal that the code belongs somewhere else.

**Server-only is enforced by three mechanisms, and a new server-only package answers all three in order** ([ADR-0013](../docs/adr/0013-a-server-only-package-declares-which-guards-it-has.md)). They are not alternatives — they fail at different moments, and a package may hold more than one:

| #   | Mechanism                                                                                                   | Fails at                                            | Apply it when                                                                                                                                                            |
| --- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **The `exports` map** — withhold the subpath, or point it at a refusal module under the `browser` condition | Module resolution, so **build**                     | Always. Withholding costs nothing; the `browser` condition costs one file and is what keeps the dependency out of the client graph rather than throwing once it is there |
| 2   | **`import "server-only"`**                                                                                  | Build, but **only inside the `react-server` layer** | The module is Next-only. It resolves to an empty module under the `react-server` condition and to a bare `throw` under every other                                       |
| 3   | **`assertServerOnly()`** from the package's own `#server-only`                                              | Runtime, at import                                  | Always, as a backstop. Never as the plan                                                                                                                                 |

**The dividing line for 2 is verified rather than assumed: plain `node` sets no `react-server` condition, so `server-only` throws there** — and plain `node` is what `packages/domain/src/migrate/cli.ts` is in a Fly `release_command`, what the `email dev` preview server is, and what every Node-environment Vitest file is. That is why `@repo/domain` carries the marker on `connection.ts` and `health.ts` and nowhere else, and why `@repo/observability` and `@repo/notifications` carry it nowhere at all. Route Handlers **are** inside the `react-server` layer (checked: `pnpm build` compiles and `GET /api/health` answers 200 with the marker in place). The root `.oxlintrc.json` allows `server-only` in `import/no-unassigned-import` for this, the same way it already allows `**/*.css` — that is the rule's own escape hatch, not a relaxation of `--max-warnings 0`.

**`@repo/notifications` holds mechanism 1 in both its forms too, and that closes ADR-0013's one named gap.** It publishes `./send` and `./templates/*` and withholds everything else, and each published entry points at `src/browser-refusal.ts` under the `browser` condition. Before that it had only the runtime backstop, which is why it was the package with the weakest guard and the strongest credential. What the fix measured, rather than predicted: a `"use client"` page calling the send seam used to **compile successfully** and put 152 occurrences of `resend`, the live `api.resend.com` endpoint and `RESEND_API_KEY` into `.next/static`; it now fails to resolve, and a server-path import leaves the client bundle with none of them. The counts and the verbatim Turbopack error are in that file.

**Mechanism 3 is duplicated in all three packages on purpose.** The shared part is the `globalThis.window` check; the part that matters is the package name, the thing it holds, and what to import instead — `pino` and its streams, a Node TCP client and the database credentials, `RESEND_API_KEY` and the one irreversible act in this system. A backstop that fires with the wrong name and the wrong remedy is worse than ten duplicated lines. ADR-0013 answers a review comment proposing to share it; do not re-argue it.

**Mechanism 1 is the mechanism, and it is the only one of the three with a test.** `apps/web/domain-boundary.test.ts` and `notifications-boundary.test.ts` assert it against **Node's own resolver**, which is the one `next build` uses.

**It is tsconfig `paths` in `apps/web` (its `@/` alias, in `apps/web/AGENTS.md`) and the `imports` field in `@repo/domain`, and the difference is not an inconsistency to tidy up.** The paragraph below is why the package uses `#`: it must resolve under plain `node`, which tsconfig `paths` cannot do. `apps/web` has the opposite constraint — it never runs outside the bundler, and **Turbopack does not resolve a package's own `imports` subpaths**. Measured, not assumed: `#lib/auth` type-checks and passes Vitest, then fails `next build` with `Module not found: Can't resolve '#lib/auth'`. Each side uses the one mechanism its own runtime supports.

**Inside `@repo/domain`, internal imports are `#`-prefixed** — `#config`, `#schema`, `#connection` — declared in the package's `imports` field. This is not style. The package withholds most of its own modules, so a self-reference through `@repo/domain/...` fails for exactly the reason it is supposed to; and a relative `./config.js` specifier resolves under Vite but **not** under plain `node`, which is what `packages/domain/src/migrate/cli.ts` runs as in a Fly `release_command`. The `imports` field is the one form Node, Vite and `tsc` all resolve identically, and a `#` specifier is private to the package that declares it, so it is not a second door into the domain.

**A dynamic import carries a comment naming the module it keeps out of which graph, or it is a static
import** (#243). `await import(...)` inside a function reads as a decision, so it gets copied as one:
twenty-nine `@repo/domain` facade methods opened by importing `#connection`, each arguing at length
that a static import would make its module unimportable at seam 1 and seam 2 — and six further sites
took the shape where no marker existed at all. **That argument was about the test runner, and one
line answers it**: a `resolve.alias` mapping `server-only` to an empty module, which both
`packages/domain/vitest.config.mts` and `apps/web/vitest.config.mts` now carry with its measurement
beside it. `db()` was already lazy, so a static import opens no pool. An `apps/web` test that loads a
server module also declares `@vitest-environment node`, because the runtime backstop fires on a
`window` and an alias does not touch that.

**One of the twenty-nine survived, and it is the shape of reason the rule is asking for.**
`rate-limit.ts` is reached by `#auth/config`, which `admin/enrol-cli.ts` imports — so it sits on the
graph of a command that runs as plain `node`, which sets no `react-server` condition and cannot load
`#connection` at all. Made static, `pnpm admin:enrol` dies before printing its usage line. Its
comment says that, and says which graph the deferral keeps `#connection` off. The other two survivors
are `@repo/storage` deferring the AWS SDK so `missingConfig()` answers without loading it, and Next's
own late binding in `instrumentation*.ts`. A site with no such sentence is a static import.

**An Admin comes into existence from a shell and nowhere else** (#17, #103, runbook §6). No form
creates one; `isAdmin` is declared `input: false`, so no request body sets the grant on any Better
Auth route, and neither command below is in `@repo/domain`'s `exports` map. Both run over the
**direct** connection.

**`pnpm admin:enrol <email>` is the one to use, and the grant is its last step.** It mints a
single-use setup link and prints it; opening the link shows the TOTP QR, the manual-entry secret and
the ten backup codes **once**; the six digits from the authenticator are typed back into the prompt,
which verifies them and only then sets `isAdmin`. That ordering is the security property — an Account
cannot hold Admin authority until a working authenticator has proved itself, so a half-enrolled Admin
is unrepresentable and a link opened and abandoned leaves no Admin behind. Running it again is both
the second-Admin recovery path and the break-glass: it replaces the factor rather than adding one.

**`pnpm admin:grant` was what it replaced, and it is gone.** It set the grant **first** and left the
second factor to a later sign-in at `/admin/sign-in` — the window `admin:enrol` closes — so its
successful path produced an Account holding Admin authority with nothing in front of it. It stood for
one slice as a command that printed a refusal and exited `2`, and the file, the script, the route,
the `emailAndPassword` configuration and the `twoFactor` plugin went together in the contract half of
DD5. There is one way to make an Admin, and it is the paragraph above.
