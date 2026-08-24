# Data policy

Owner: **Data lead** ([owners.md](owners.md)). Read by `data-design`.

An `UNSET` value is raised as a flagged concern naming this file and the key. It is never guessed.

**This template ships no database.** There is no `packages/db`, no Postgres, no Redis, no ORM. Every
key below is therefore `UNSET` by necessity rather than by caution, and the first effort that needs
a store settles them as part of its own spec.

| Key                         | Value   | What it settles                                                                                                                                                                |
| --------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `store`                     | `UNSET` | The primary datastore and its version. Drives everything below                                                                                                                 |
| `orm`                       | `UNSET` | The query layer, and whether the schema is defined in it or in SQL                                                                                                             |
| `pk-strategy`               | `UNSET` | Primary key type. `uuidv7()` is built into Postgres 18 and time-ordered, so it indexes like a sequence without leaking a row count — a good default nobody has chosen here yet |
| `soft-delete`               | `UNSET` | Whether rows are deleted or tombstoned, and which one retention counts against                                                                                                 |
| `migration-policy`          | `UNSET` | Whether migrations must be reversible, and what makes a one-way migration acceptable                                                                                           |
| `retention-personal`        | `UNSET` | How long personal data is kept and by what path it is deleted. Bounded by `compliance-regime` in [security.md](security.md)                                                    |
| `retention-internal`        | `UNSET` | Same, for internal data                                                                                                                                                        |
| `retention-logs`            | `UNSET` | Same, for logs. A log line inherits the classification of what it contains                                                                                                     |
| `remote-cache-handler`      | `UNSET` | The store under `use cache: remote`, wired through `cacheHandlers` in `next.config.ts`, or an explicit "none"                                                                  |
| `backup-rpo` / `backup-rto` | `UNSET` | How much data a restore may lose, and how long it may take                                                                                                                     |

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
