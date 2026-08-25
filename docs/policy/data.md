# Data policy

Owner: **Data lead** ([owners.md](owners.md)). Read by `data-design`.

An `UNSET` value is raised as a flagged concern naming this file and the key. It is never guessed.

**The store is chosen; the schema is not.** Effort 0002 settles `store` and `remote-cache-handler`
because the platform's shape forced both: Spanish full-text search needs Postgres, and a single Fly
machine needs no shared cache handler. Every other key below waits for the spec that first writes a
table.

| Key                         | Value                                                                                                                                                                                                                             | What it settles                                                                                                                                                                |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `store`                     | **PlanetScale Postgres**                                                                                                                                                                                                          | The primary datastore and its version. Drives everything below                                                                                                                 |
| `orm`                       | **Drizzle**, schema in the ORM, with committed SQL migrations                                                                                                                                                                     | The query layer, and whether the schema is defined in it or in SQL                                                                                                             |
| `pk-strategy`               | **`BIGINT GENERATED ALWAYS AS IDENTITY`**, and a UUIDv7 only where an id reaches a URL or a browser (generated app-side by `uuid@14`). Better Auth owns its own tables' ids                                                       | Primary key type. `uuidv7()` is built into Postgres 18 and time-ordered, so it indexes like a sequence without leaking a row count — a good default nobody has chosen here yet |
| `soft-delete`               | **No** — hard delete, plus storage objects, plus in-place reduction to counts                                                                                                                                                     | Whether rows are deleted or tombstoned, and which one retention counts against                                                                                                 |
| `migration-policy`          | **Expand/contract, forward-fix; no `down` required.** A contracting migration may not ship in the same deploy as the code change that frees the column                                                                            | Whether migrations must be reversible, and what makes a one-way migration acceptable                                                                                           |
| `retention-personal`        | **Reports 24 mo; Offers 12 mo from send (pinned by a live Report); ContactExchange 12 mo then reduced to monthly counts; CheckIns follow their exchange; Account, profile and photo 12 mo after last sign-in.** Purged leaf-first | How long personal data is kept and by what path it is deleted. Bounded by `compliance-regime` in [security.md](security.md)                                                    |
| `retention-internal`        | **Indefinite for non-identifying monthly counts** (`month`, `exchanges`, `checkInsAnswered`, `workHappened`, `wasPaid`); `AdminAction` 24 mo, matching Reports                                                                    | Same, for internal data                                                                                                                                                        |
| `retention-logs`            | **30 days**                                                                                                                                                                                                                       | Same, for logs. A log line inherits the classification of what it contains                                                                                                     |
| `retention-backups`         | **7 days.** Deletion is complete when that window rolls past, and the deletion copy says so                                                                                                                                       |
| `remote-cache-handler`      | **none**                                                                                                                                                                                                                          | The store under `use cache: remote`, wired through `cacheHandlers` in `next.config.ts`, or an explicit "none"                                                                  |
| `backup-rpo` / `backup-rto` | **≤ 1 h / ≤ 4 h**, proven by one real restore — rows and storage objects together — before the announcement                                                                                                                       | How much data a restore may lose, and how long it may take                                                                                                                     |

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
