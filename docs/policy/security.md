# Security policy

Owner: **Security owner** ([owners.md](owners.md)). Read by `security-design`.

An `UNSET` value is raised as a flagged concern naming this file and the key. It is never guessed.

| Key                      | Value                                                                                                                                                                                                                           | What it settles                                                                                                                                                                                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth-provider`          | **Better Auth**                                                                                                                                                                                                                 | Who issues and verifies identity. Until set, no spec can say where a session comes from or how it is revoked                                                                                                                                                                |
| `session-lifetime`       | **Own device 30 d rolling; self-declared shared device 8 h; Admin 8 h, no rolling. Enforced on the session row, cookie cache off. Revoked before expiry by the owner from any device, and by an Admin while handling a Report** | How long a session stays valid, and how it is revoked **before** that expiry. Both halves, or the value is not set                                                                                                                                                          |
| `mfa-requirement`        | **Admin only**                                                                                                                                                                                                                  | Which principals must present a second factor, and for which operations                                                                                                                                                                                                     |
| `threat-model-scope`     | **Anyone on the internet**                                                                                                                                                                                                      | Which adversaries are in scope. "Anyone on the internet" is a real answer; so is "authenticated tenants only"                                                                                                                                                               |
| `compliance-regime`      | **Ley 1581 de 2012** (Colombia)                                                                                                                                                                                                 | SOC 2, HIPAA, GDPR, PCI, none. Drives retention in [data.md](data.md) and what a breach obliges you to do                                                                                                                                                                   |
| `secret-store`           | **`fly secrets`, mirrored in the operator's password manager. No secret in a repo `.env`**                                                                                                                                      | Where secrets live and who can rotate each one. `.env` files are Turborepo build inputs — rotation invalidates cache                                                                                                                                                        |
| `csp-policy`             | **`default-src 'self'; frame-ancestors 'none'; img-src 'self' <image-host> data:; connect-src 'self' <sentry-ingest>; base-uri 'self'; form-action 'self'`, enforced (not report-only)**                                        | The Content-Security-Policy the app ships, or an explicit decision not to ship one                                                                                                                                                                                          |
| `dependency-policy`      | **CI fails on `high` or above in a direct dependency. No licence allowlist**                                                                                                                                                    | What blocks a release: a CVE severity threshold, a licence allowlist, or neither                                                                                                                                                                                            |
| `audit-report-threshold` | **`moderate` and above, transitive as well as direct, reported daily as a `needs-triage` issue and never blocking**                                                                                                             | The severity at which an advisory the blocking gate lets past still has to reach a person. `dependency-policy` says what stops a release; this says what nobody is allowed to not hear about                                                                                |
| `pentest-cadence`        | **None external.** Internally: `security-review` per PR touching auth, the exchange path or an egress; a full `/security-audit` run before the announcement and after major auth or exchange work                               | How often an external party looks, if ever                                                                                                                                                                                                                                  |
| `secrets-in-url-paths`   | **yes** — one route, `GET /admin/enrol/[token]`. See below                                                                                                                                                                      | Whether any route carries a credential in a path segment — password reset, signed invite, unsubscribe. If yes, the completion line logs it verbatim ([ADR-0006](../adr/0006-name-the-exposure-rather-than-ship-a-heuristic.md)) and the path must be bounded before go-live |

### Why `dependency-policy` and `audit-report-threshold` are two keys

They answer different questions and a single key would have to pick one. `dependency-policy` sets
what **blocks**: `high` or above in a direct dependency, deliberately narrow, because a gate that is
red on arrival is bypassed within a week. `audit-report-threshold` sets what somebody is **told**,
and it is wider on both axes — every severity from `moderate`, and transitive as well as direct.

The gap between them was not theoretical. Six advisories, four of them `high`, sat on the default
branch while every pull request went green: each was transitive, so the blocking gate correctly let
them past, and Dependabot could open no pull request for any of them because dependabot-core does not
support updating transitive dependencies for the pnpm ecosystem. Nothing was broken. Nobody was
told. `.github/workflows/security-audit.yml` is the actor this key exists to point at.

### The one exception to "no secret in a repo `.env`"

`apps/web/.env.example` and `docker/pgbouncer/userlist.txt` carry a username, a password and a
database name in git. Under the classification vocabulary in [data.md](data.md) those are `secret`,
so the exception is written here — beside the rule it bends — rather than argued past somewhere else.

It is narrow, and every clause is load-bearing. The values reach **only** the containers
`docker-compose.yaml` starts; those publish to `127.0.0.1` and to nothing else, so the credential
authorizes a principal who is already on the machine and can read the file anyway. They are created
by the compose file itself, so there is nothing to rotate and no other system where they are also
valid. `.env.local` — the file that carries a real one — stays gitignored.

**What would end the exception:** a port published on `0.0.0.0`, a value reused anywhere outside
`docker-compose.yaml`, or a second environment reachable with it. Any of the three and these stop
being non-secret, whatever this file says. `local-database` in [data.md](data.md) is the key that
settles the stack itself.

## Already settled by the stack

These are not `UNSET` and not open. They come from the framework, so a spec contradicting one is a
concern rather than a preference.

| Fact                                                                  | Where it comes from     |
| --------------------------------------------------------------------- | ----------------------- |
| Every Server Action is a public endpoint and authorizes independently | Next.js App Router      |
| `use cache` / `use cache: remote` are shared across all users         | Cache Components        |
| Middleware is not an authorization boundary                           | Next.js App Router      |
| Anything passed to a client component is in the browser payload       | React Server Components |
| Secrets never reach `NEXT_PUBLIC_*`                                   | Next.js build           |

## Answered by the effort 0002 design interview

**`auth-provider` is Better Auth, and the two sides are deliberately asymmetric.** A Worker or a
Hirer signs in by **magic link**, with no password at all; an **Admin** presents a password _and_ a
TOTP code. That asymmetry is what `mfa-requirement` records. Requiring an authenticator app from a
displaced person trades real abandonment — a lost phone is a lost profile — against protecting a
first name and a list of Skills. The Admin account can take down a CapabilityProfile and read every
phone number in the system, and is the one worth hardening.

**`threat-model-scope` is "anyone on the internet", and that phrase carries more than usual here.**
Under [ADR-0008](../adr/0008-open-enrolment-with-published-non-verification.md) nobody is verified,
so the adversary may arrive as a **Hirer** _or_ as a **Worker**. Both directions are in scope, and a
spec that models only one of them has modelled half the system.

**`compliance-regime` is Colombia's Ley 1581 de 2012** (habeas data), which applies because the
platform collects and publishes personal data about identifiable people. The named _responsable del
tratamiento_ is still outstanding: until a partner organization takes it, the controller is the repo
owner personally. That gap is tracked by the effort, not by this key.

**`secrets-in-url-paths` was `no`, checked rather than assumed, and #103 flipped it.** Better Auth's
magic-link plugin verifies at `GET /magic-link/verify` with the token as a **query parameter**, and
`pathOf` strips query and hash before the request-completion line is written — so
[ADR-0006](../adr/0006-name-the-exposure-rather-than-ship-a-heuristic.md)'s exposure never applied to
it. That is still true of the magic link. **The value records the routes that exist today, not a
principle**, and one route now carries a token in a path segment.

**The route is `GET /admin/enrol/[token]`**, the Admin's enrolment screen. The spec's API contract,
the surface brief and the ticket all name that shape, and the query-parameter form — which is what
keeps this key at `no` — was not taken, so the exposure is accepted rather than avoided. Observed
rather than predicted: `context.path` on the request-completion line reads

```json
{
  "msg": "request complete",
  "route": "/admin/enrol/[token]",
  "context": { "path": "/admin/enrol/IGXP5rGQFXIydyv-d0HD1rwAoT4DzR7T" }
}
```

**What the exposure actually is, stated rather than waved at.** The token is good for fifteen minutes
and is spent the moment the terminal confirms; log lines are kept thirty days. So a line read after
the enrolment finished carries a credential that opens nothing, and the window in which it is live is
one in which the operator is sitting at the prompt that printed it. The token is also printed to that
operator's own terminal and never emailed, so the population that can see the log and the population
that already had the link are close to the same one — on this product, the same person.

**What it is not is nothing**, and two things follow. A drain is a second place a live token exists
for those fifteen minutes, which is a real widening of where a credential lives. And the value of
this key is what a reader consults before adding the _next_ token-in-a-path route, where none of the
mitigating clauses above may hold.

**Go-live runbook §10 carries the bounding step.** Whatever else changes, the enrolment path must not
reach a third-party drain in the clear before the announcement.
