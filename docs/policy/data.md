# Data policy

Owner: **Data lead** ([owners.md](owners.md)). Read by `data-design`.

An `UNSET` value is raised as a flagged concern naming this file and the key. It is never guessed.

**The store is chosen; the schema is not.** Effort 0002 settles `store` and `remote-cache-handler`
because the platform's shape forced both: Spanish full-text search needs Postgres, and a single Fly
machine needs no shared cache handler. Every other key below waits for the spec that first writes a
table.

**`local-database` is the one key here the spec never raised**, and it was set at Build rather than at
Design: the spec mentions Docker and Compose zero times, and C13's answer implies a hosted development
database without ever deciding one. #49 is where that was noticed and answered.

| Key                         | Value                                                                                                                                                                                                                                                                               | What it settles                                                                                                                                                                                                                                                                                    |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `store`                     | **PlanetScale Postgres**                                                                                                                                                                                                                                                            | The primary datastore and its version. Drives everything below                                                                                                                                                                                                                                     |
| `local-database`            | **Docker Compose — Postgres 18 behind PgBouncer in transaction-pooling mode.** `docker-compose.yaml` at the repo root; `pnpm db:up` starts it. The app takes the pooled connection on **6432**, migrations the direct one on **5432**. Opt-in: tests use PGlite and CI uses neither | What `pnpm dev` connects to on a developer's machine, and whether a pooler sits in front of it. See the section below                                                                                                                                                                              |
| `orm`                       | **Drizzle**, schema in the ORM, with committed SQL migrations                                                                                                                                                                                                                       | The query layer, and whether the schema is defined in it or in SQL                                                                                                                                                                                                                                 |
| `pk-strategy`               | **`BIGINT GENERATED ALWAYS AS IDENTITY`**, and a UUIDv7 only where an id reaches a URL or a browser (generated app-side by `uuid@14`). Better Auth owns its own tables' ids                                                                                                         | Primary key type. `uuidv7()` is built into Postgres 18 and time-ordered, so it indexes like a sequence without leaking a row count — a good default nobody has chosen here yet                                                                                                                     |
| `enum-value-naming`         | **`snake_case`** for every enum-shaped stored value — anything behind a `CHECK` constraint or read as a discriminator — even where the value names a camelCase operation (`request_magic_link`, never `requestMagicLink`)                                                           | What a stored enum value looks like. Effort 0002 shipped `rate_counter.action = 'requestMagicLink'` beside `session.sign_in_method = 'magic_link'`; both sit behind `CHECK` constraints, so the rename now costs a migration (#79 row 7). Existing values stand until a migration is otherwise due |
| `soft-delete`               | **No** — hard delete, plus storage objects, plus in-place reduction to counts                                                                                                                                                                                                       | Whether rows are deleted or tombstoned, and which one retention counts against                                                                                                                                                                                                                     |
| `migration-policy`          | **Expand/contract, forward-fix; no `down` required.** A contracting migration may not ship in the same deploy as the code change that frees the column                                                                                                                              | Whether migrations must be reversible, and what makes a one-way migration acceptable                                                                                                                                                                                                               |
| `retention-personal`        | **Reports 24 mo; Offers 12 mo from send (pinned by a live Report); ContactExchange 12 mo then reduced to monthly counts; CheckIns follow their exchange; Account, profile and photo 12 mo after last sign-in.** Purged leaf-first                                                   | How long personal data is kept and by what path it is deleted. Bounded by `compliance-regime` in [security.md](security.md)                                                                                                                                                                        |
| `retention-internal`        | **Indefinite for non-identifying monthly counts** (`month`, `exchanges`, `checkInsAnswered`, `workHappened`, `wasPaid`); `AdminAction` 24 mo, matching Reports                                                                                                                      | Same, for internal data                                                                                                                                                                                                                                                                            |
| `retention-logs`            | **30 days**                                                                                                                                                                                                                                                                         | Same, for logs. A log line inherits the classification of what it contains                                                                                                                                                                                                                         |
| `retention-backups`         | **7 days.** Deletion is complete when that window rolls past, and the deletion copy says so                                                                                                                                                                                         |
| `remote-cache-handler`      | **none**                                                                                                                                                                                                                                                                            | The store under `use cache: remote`, wired through `cacheHandlers` in `next.config.ts`, or an explicit "none"                                                                                                                                                                                      |
| `backup-rpo` / `backup-rto` | **≤ 1 h / ≤ 4 h**, proven by one real restore — rows and storage objects together — before the announcement                                                                                                                                                                         | How much data a restore may lose, and how long it may take                                                                                                                                                                                                                                         |

## The local database, and why it is not a plain Postgres

`pnpm dev` connects to a **Docker Compose** stack: `postgres:18-alpine` on **5432**, and
**PgBouncer in `pool_mode = transaction`** in front of it on **6432**. The commands that start it are
in the README, and the file that defines it is `docker-compose.yaml`; what belongs here is why it has
two containers rather than one.

**The pooler is the whole reason this is not one container.** DD2 fixes PlanetScale's pooler in
transaction-pooling mode, which removes `LISTEN`/`NOTIFY`, session advisory locks, temp tables and
cross-transaction prepared statements. The spec has already bent around that twice — DD10's
scheduler cannot use an advisory-lock single-runner, and `pg` is pinned rather than `postgres.js`
because the latter prepares by default. Against a plain unpooled Postgres every one of those
mistakes passes lint, type-check, tests and CI, and fails after deploy. Running the same pooler in
the same mode locally means the local database refuses what production refuses, on the machine of
the person writing the code.

So **two URLs pointing at one unpooled Postgres would not satisfy this key.** They would prove
nothing, which is the failure the key exists to prevent.

The two candidates that were not chosen, and what each costs:

|                        | Same engine as production | Offline, no credential                 | Reproduces the transaction pooler   |
| ---------------------- | ------------------------- | -------------------------------------- | ----------------------------------- |
| PlanetScale dev branch | exact                     | **no** — a credential on every machine | yes                                 |
| **Docker Compose**     | Postgres 18               | yes                                    | **yes**, with PgBouncer in the file |
| PGlite, file-backed    | Postgres 18.3             | yes                                    | **no** — single connection          |

**What it costs, stated rather than waved through.** It adds Docker to a toolchain that was Node 24
and pnpm and nothing else. It stays a **`pnpm dev` requirement, not a repository one**: `pnpm test`
runs against PGlite in-memory (spec 0002, Testing Decisions seam 2) and CI starts no database
service, so a clone can install, type-check, test, build and pass the full gate with Docker never
installed. `CLAUDE.md`'s Toolchain section carries the version floor.

**Three things about it that are deliberate and would otherwise read as oversights:**

- **The credentials are in git.** `docker-compose.yaml`, `docker/pgbouncer/userlist.txt` and
  `apps/web/.env.example` carry the same development-tier user, password and database name, reaching
  a container on loopback. `.env.local` stays gitignored and a real credential lives in
  `fly secrets` ([security.md](security.md) → `secret-store`) — `.env*` is a Turborepo `build` input,
  so a production URL in any committed one is the incident C13 names.
- **PgBouncer is stock, including the parts that are sharp.** In transaction mode it does not run
  `DISCARD ALL` between clients, so session state one client leaves on a server connection — a
  `SET`, a named prepared statement — is visible to the next client that lands on it. That is a real
  hazard and it is _production's_ hazard; smoothing it out locally would hide the thing this key was
  set to expose.
- **The engine version drifts three ways**: PlanetScale 18.4, PGlite 0.5.7 is 18.3, this is 18.6.
  One major version, which is the alignment seam 2's argument actually rests on.

**Images are pinned by tag and digest and stamped at a date** (2026-08-26), the way
[`../runbooks/observability-go-live.md`](../runbooks/observability-go-live.md) pins a vendor figure.
`.github/dependabot.yml` carries a `docker-compose` entry so a pin is a deliberate act somebody
performs rather than a version frozen at whatever was current the day it was written.

**Nothing checks that `docker-compose.yaml` and `apps/web/.env.example` still agree**, and the
honest version of why is worth stating, because the obvious one is wrong. Drift does fail loudly —
but **not for the person who caused it**. They already hold a working `.env.local`, which is a copy
rather than the file they edited, so the failure lands on the next clone instead. This is a real gap
in a repository that built `scripts/migration-integrity.mjs` and `scripts/audit-direct.mjs` for
exactly this class of thing. It is left open because the drifting surface is three ports and a
username across two files, and the fix is a new script and a new turbo task; if the surface grows,
this is the first thing to revisit.

## Classification vocabulary

Fixed. Every new column carries exactly one, and an unclassified column is a concern.

| Class      | Meaning                                   | Consequences                                                            |
| ---------- | ----------------------------------------- | ----------------------------------------------------------------------- |
| `public`   | Safe to serve to anyone                   | May sit in a shared cache                                               |
| `internal` | Not secret, not for users outside the org | May sit in a shared cache; not in a client payload by default           |
| `personal` | Identifies or describes a person          | Never in a shared cache. Carries a retention period and a deletion path |
| `secret`   | Credentials, tokens, keys                 | Never cached, never logged, never crosses to the client                 |

## Already settled by the stack

| Fact                                                                                            | Where it comes from |
| ----------------------------------------------------------------------------------------------- | ------------------- |
| Cache entries do not survive a deploy — the key includes the build ID                           | Cache Components    |
| `revalidateTag()` invalidates one instance; cross-instance needs `refreshTags()` in the handler | Cache Components    |
| `use cache: private` is browser memory only and reads runtime APIs directly                     | Cache Components    |
| `use cache` and `use cache: remote` cannot read `cookies()`, `headers()`, or `searchParams`     | Cache Components    |
