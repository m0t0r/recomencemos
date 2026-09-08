# Security policy

Owner: **Security owner** ([owners.md](owners.md)). Read by `security-design`.

An `UNSET` value is raised as a flagged concern naming this file and the key. It is never guessed.

| Key                      | Value                                                                                                                                                                                                                                                                                                                                         | What it settles                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth-provider`          | **Better Auth**                                                                                                                                                                                                                                                                                                                               | Who issues and verifies identity. Until set, no spec can say where a session comes from or how it is revoked                                                                                                                                                                                                                                                                                                                     |
| `session-lifetime`       | **Own device 30 d rolling; self-declared shared device 8 h; Admin 8 h, no rolling. Enforced on the session row, cookie cache off. Revoked before expiry by the owner from any device, and by an Admin while handling a Report**                                                                                                               | How long a session stays valid, and how it is revoked **before** that expiry. Both halves, or the value is not set                                                                                                                                                                                                                                                                                                               |
| `mfa-requirement`        | **Admin only**                                                                                                                                                                                                                                                                                                                                | Which principals must present a second factor, and for which operations                                                                                                                                                                                                                                                                                                                                                          |
| `threat-model-scope`     | **Anyone on the internet**                                                                                                                                                                                                                                                                                                                    | Which adversaries are in scope. "Anyone on the internet" is a real answer; so is "authenticated tenants only"                                                                                                                                                                                                                                                                                                                    |
| `compliance-regime`      | **Ley 1581 de 2012** (Colombia)                                                                                                                                                                                                                                                                                                               | SOC 2, HIPAA, GDPR, PCI, none. Drives retention in [data.md](data.md) and what a breach obliges you to do                                                                                                                                                                                                                                                                                                                        |
| `secret-store`           | **`fly secrets`, mirrored in the operator's password manager. No secret in a committed `.env`; a development-tier credential may sit in gitignored `.env.local`** — see "The two `.env` files" below                                                                                                                                          | Where secrets live and who can rotate each one. `.env` files are Turborepo build inputs — rotation invalidates cache                                                                                                                                                                                                                                                                                                             |
| `csp-policy`             | **`default-src 'self'; frame-ancestors 'none'; img-src 'self' <image-host> data:; connect-src 'self' <sentry-ingest>; base-uri 'self'; form-action 'self'`, enforced (not report-only)**                                                                                                                                                      | The Content-Security-Policy the app ships, or an explicit decision not to ship one                                                                                                                                                                                                                                                                                                                                               |
| `dependency-policy`      | **CI fails on `high` or above in a direct dependency. No licence allowlist**                                                                                                                                                                                                                                                                  | What blocks a release: a CVE severity threshold, a licence allowlist, or neither                                                                                                                                                                                                                                                                                                                                                 |
| `audit-report-threshold` | **`moderate` and above, transitive as well as direct, reported daily as a `needs-triage` issue and never blocking**                                                                                                                                                                                                                           | The severity at which an advisory the blocking gate lets past still has to reach a person. `dependency-policy` says what stops a release; this says what nobody is allowed to not hear about                                                                                                                                                                                                                                     |
| `pentest-cadence`        | **None external.** Internally: the `REVIEW.md` **Security review** pass per PR touching auth, the exchange path or an egress; a full `/security-audit` run before the announcement and after major auth or exchange work. Both are read by the `security-auditor` subagent under [`../agents/security-audit.md`](../agents/security-audit.md) | How often an external party looks, if ever                                                                                                                                                                                                                                                                                                                                                                                       |
| `secrets-in-url-paths`   | **yes** — one route, `GET /admin/enrol/[token]`. See below                                                                                                                                                                                                                                                                                    | Whether any route carries a credential in a path segment — password reset, signed invite, unsubscribe. If yes, the completion line logs it verbatim ([ADR-0006](../adr/0006-name-the-exposure-rather-than-ship-a-heuristic.md)) and the path must be bounded before go-live                                                                                                                                                      |
| `artifact-egress`        | **yes** — recordings and screenshots of the running app are published to an object store that serves **unauthenticated** reads, under an unguessable prefix. Review artifacts expire; story demos do not. See "What a published artifact may never contain" below                                                                             | Whether anything leaves this system to a public origin that is not the app itself. Set by [ADR-0019](../adr/0019-ui-change-carries-recorded-proof-not-asserted-proof.md) and provisioned by [`../runbooks/ui-proof-artifacts.md`](../runbooks/ui-proof-artifacts.md). It is a key rather than a line in `build.md` because a future spec proposing a second kind of artifact needs `security-design` to hit this on the way past |
| `sbom`                   | **Generated on demand, never stored** — `pnpm sbom --sbom-format cyclonedx --sbom-type application --lockfile-only` at the commit in question. It covers the npm graph and not the image under it. See below                                                                                                                                  | Whether this system publishes a software bill of materials, in what format, and produced when. Set by #213, once pnpm 12 made one a single command                                                                                                                                                                                                                                                                               |

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

### Why `sbom` is "on demand" rather than a build artifact

`pnpm sbom` arrived with pnpm 12 and made a bill of materials one command, which is what put the
question here at all. Two measurements decide where it runs, and both cut the same way.

**`--lockfile-only` produces the document from the committed lockfile, with no install and no
store.** So the SBOM for any commit this repository has ever had is reproducible from git by checking
that commit out and running one command. An SBOM stored per build would therefore record nothing git
does not already carry, while creating a second place "what shipped" is written down — and a second
place is a place that can disagree with the first. The lockfile is the bill of materials; the SBOM is
a serialization of it for a reader who cannot parse pnpm's format.

**And it would be an incomplete document filed as though it were complete.** What deploys is a
container built `FROM node:24-slim`, so what ships includes a Debian userland, its OpenSSL, and the
Node build itself — none of which pnpm can see. A CycloneDX file attached to a release, named for the
release, implies coverage it does not have. Producing it on request, from a lockfile, with the scope
stated in the key, does not.

**`--sbom-type application` is not optional decoration.** The flag defaults to `library`, which would
put `metadata.component.type: "library"` at the head of a document describing a deployed service — a
false statement in the one artifact this key exists to keep honest. The rest of the command is the
default: CycloneDX 1.7, dev and production dependencies both.

So: no job in `.github/workflows/ci.yml`, no artifact retention window, and no row on the go-live
checklist — a checklist row nobody ever ticks is worse than an absent one, and nothing in
`compliance-regime` (Ley 1581 de 2012, which is about personal data rather than supply chain) obliges
one. What the key buys is that the next person asked for an SBOM by a partner organization has the
command, the format, and the sentence about what it does not cover.

**What would change this answer**: a partner or a customer contract that requires an SBOM _archived_
per release, or a move off a base image — at which point the honest artifact is a container SBOM from
a scanner that reads image layers, and `pnpm sbom` is one input to it rather than the thing itself.

### The two `.env` files, and why the rule names only one of them

**This is an amendment, and it is written as one rather than as a clarification.** The key used to
read _"no secret in a repo `.env`"_, which on its face reaches `apps/web/.env.local` — that file is a
repo path, and `turbo.json` declares `.env*` a `build` input, which is the reason the key gives. But
`apps/web/.env.example` has said the opposite in as many words since it was written: of
`RESEND_API_KEY`, _"To send from a development machine, put it in `.env.local`, which is gitignored"_,
and of `GOOGLE_CLIENT_SECRET`, _"To try the Google door locally, put both in `.env.local`"_. Two
committed artifacts disagreed, and the practice followed the example rather than the key. Naming the
distinction is what closes that, and the alternative — reading the key narrowly in a runbook, where
nobody looking for the rule would find it — is how a policy becomes something each document decides
for itself.

The line is **committed or not**, and it is exactly the line git already draws:

| File                    | In git | May hold a real credential                                                                |
| ----------------------- | ------ | ----------------------------------------------------------------------------------------- |
| `apps/web/.env.example` | Yes    | **Never.** Development-tier values only, and the narrow exception below                   |
| `apps/web/.env.local`   | No     | **Yes, development-tier.** One machine's own key, for a process that runs on that machine |
| `fly secrets`           | n/a    | Every production credential. Mirrored in the password manager, and nowhere on disk        |

**Two things the permission does not buy, and both have teeth.** A production credential still never
reaches `.env.local` — the file is one `git add -f` and one screen-share from being public, and its
whole safety is that nothing there authorizes anything beyond the machine it sits on. And the cache
consequence the key names is real for this file: `turbo.json` declares `.env*` a `build` input, so
editing `apps/web/.env.local` invalidates `web#build`. That is a cost in seconds, paid by the person
who edited it; it is not a reason to keep a credential somewhere the process cannot read it.

`.claude/hooks/build-guard.sh` rule I is **not** what enforces any of this, and assuming otherwise is
the mistake to avoid: it matches five unambiguous formats — an AWS access key id, a GitHub token, an
Anthropic key, a Slack token, a PEM private key — so a credential shaped like anything else passes it.
What keeps a secret out of git here is `.gitignore`, and the fact that the committed file is reviewed.

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

## What a published artifact may never contain

[ADR-0019](../adr/0019-ui-change-carries-recorded-proof-not-asserted-proof.md) makes a Build session
publish recordings of a running app to a URL. That is a new egress, and it is a **stronger** one than
the log line this file already reasons about: a drain is read by an operator inside a retention
window, while an artifact is fetched by whoever holds the link, whenever they like.

Three rules, and the first is the reason this section exists rather than a sentence in the skill.

**`GET /admin/enrol/[token]` is never recorded.** A recording captures the address bar, and
`secrets-in-url-paths` above says that route carries a live credential in a path segment. Every
clause that bounds the logging exposure — fifteen minutes, spent on confirmation, printed to the
operator's own terminal, a population that already held the link — fails here: an artifact outlives
the token's validity and reaches a population that never had it. There is no cropping exception. That
surface is verified with no camera running.

**Every capture runs against seeded fixtures.** A name, a phone number, a photograph or a message in a
published artifact is personal data leaving the system.
[ADR-0009](../adr/0009-a-workers-full-identity-is-gated-and-never-indexed.md) gates a Worker's full
identity and `compliance-regime` is Ley 1581; neither distinguishes a leak in a page from a leak in a
video of that page.

**A durable artifact takes the same rules with none of the tolerance.** A review artifact expires
under `ui-evidence-retention`, which bounds a mistake to thirty days. A story demo is kept, so a
mistake in one is permanent and its remedy is deletion by hand from the bucket. Where a flow cannot be
captured without breaching one of the rules above, the artifact is narrowed and the PR body says which
part could not be shown. A narrowed artifact is worth more than none; a leaked one is worth less.
