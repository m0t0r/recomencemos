# Data advisory — 0002 profile-to-contact-exchange

Read against `spec.md` (draft, Phase A/B — deep dives and Flagged concerns still empty), `intent.md`, `docs/policy/data.md`, `CONTEXT.md`, ADR-0003/0007/0008/0009. Engine reasoning is from `planetscale:postgres`, not recall.

This is a greenfield schema — no `packages/db` exists, nothing to migrate away from. That is the good news and it is worth the architect stating: **no change in this effort needs expand–contract.** Every migration-safety finding below is about what the schema commits us to *after* launch, plus one live hazard (Better Auth's tables).

---

## Recommend

### The queries, and the index that serves each

The API contract implies eleven reads. Naming them with their index is the exercise the spec has not yet done, and four of them are underdetermined by what is written.

| Read | Filter / sort | Index that serves it |
| --- | --- | --- |
| `GET /` (Wall) | `state='published'`, `ORDER BY published_at DESC, id DESC` LIMIT n | partial B-tree `capability_profile (published_at DESC, id DESC) WHERE state='published'` |
| `GET /perfiles` | `state='published'`, `ORDER BY delivered_offer_count ASC, <rotation>, id` | **undetermined — see below** |
| `/perfiles` + city | `city = ?` equality, then the same sort | equality column must **lead**: `(city, delivered_offer_count, rotation, id) WHERE state='published'` |
| `/perfiles` + skill | join `profile_skill` | `profile_skill (skill_id, capability_profile_id)` — the *reverse* of the natural PK |
| `/perfiles` + text | accent-insensitive Spanish | **undetermined — see below** |
| `GET /perfil/[slug]` | `slug = ?` | `UNIQUE (slug)` — and `slug` is not in the entity list at all |
| Block check | `(worker_profile_id, hirer_account_id)` | `UNIQUE (worker_profile_id, hirer_account_id)` — read on every gated view *and* every `sendOffer` |
| `GET /propuestas` | `capability_profile_id = ?`, `ORDER BY sent_at DESC`, states ≥ delivered | `offer (capability_profile_id, sent_at DESC)` |
| `GET /mis-propuestas` | `hirer_account_id = ?`, `ORDER BY sent_at DESC` | `offer (hirer_account_id, sent_at DESC)` |
| `GET /admin` (×5 branches) | each `WHERE state = <pending>`, `ORDER BY created_at` | five **partial** indexes — see below |
| `signOutEverywhere` | `DELETE session WHERE account_id = ?` | index on `session.account_id` (Better Auth may not create it) |

Two of those are the ones to settle deliberately.

- **The `/perfiles` ordering needs a stored, indexed rotation column.** NFR21 asks for "the order **within** a count band rotates on a fixed schedule". A rotation computed per request — `hash(id, now())`, `random()`, `setseed()` — is a function over an indexed column, so the planner sorts every published profile on every page load, and it destroys pagination outright: page 2 is drawn from a different ordering than page 1, so the Hirer sees duplicates and misses profiles entirely. That is the fairness mechanism defeating itself. **Recommend a `rotation_key` column** (an integer or uuid rewritten by the scheduled rotation job), so the sort is `(delivered_offer_count, rotation_key, id)`, is index-ordered, and is keyset-paginable. It also makes NFR21 testable at seam 1 as the spec already intends, because the ordering becomes a pure function of stored columns.
- **`unaccent()` is `STABLE`, not `IMMUTABLE`, so you cannot index an expression over it.** `CREATE INDEX ... ON capability_profile (unaccent(headline))` fails on PlanetScale exactly as it fails everywhere — Postgres refuses because the dictionary is mutable, and a `GENERATED ... STORED` column over it fails for the same reason. NFR20 promises 95% accent-insensitive parity and Testing Decisions asserts `unaccent` is bundled in PGlite, but the spec never says *how the normalized form is stored*. The three real options, and their consequences, should be decided at Design rather than discovered at Build:
  1. Wrap `unaccent` in a hand-declared `IMMUTABLE` SQL function. Works, is the folklore answer, and is a **lie to the planner**: change the dictionary and the index silently returns wrong rows.
  2. Normalize in the application at write time into a plain `search_text TEXT NOT NULL` column, indexed however the search strategy demands. Sidesteps Postgres immutability entirely, makes the normalizer a pure function testable at **seam 1** alongside the contact-detail rejector, and needs no `unaccent` extension at all.
  3. Build a text-search configuration with `unaccent` in its dictionary chain and store `to_tsvector(...)` in a trigger-maintained column.
  Recommend (2) unless real stemming is wanted, and if it is, (3) — but note that (3) makes the *search configuration* part of the migration, so PGlite and PlanetScale must create the same one or seam 2 tests a different search than production ships.
- **The spec has not chosen a search strategy at all.** `pg_trgm` and `unaccent` are both named as available; FTS (`to_tsvector('spanish', …)` + GIN), trigram similarity (GIN `gin_trgm_ops`), and prefix match over a normalized column need three *different* indexes and give three different answers. Pick one, because NFR20's "≥95% of the seeded vocabulary" is only measurable against a named strategy. Note that a GIN index **cannot supply ordering** — a text search combined with the `delivered_offer_count` sort is always a bitmap scan plus a sort, which is fine at launch volume and is worth writing down as a known shape rather than a surprise.

### The Admin queue is five `MIN(created_at)` queries on every screen, and partial indexes are what make that free

Story 22 puts "the age of the oldest unreviewed item" **on every screen**, and story 7's queue is a five-way union sorted by age. Without partial indexes that is five sequential scans per admin page render, growing with total table size forever while the *pending* set stays near zero. With them — `offer (created_at) WHERE state='pending_review'`, `capability_profile (photo_uploaded_at) WHERE photo_state='pending'`, `report (created_at) WHERE state='open'`, `skill_request (created_at) WHERE state='pending'`, `account (bounced_at) WHERE email_status='bounced'` — each `MIN()` is an index-only scan over a handful of tuples. This is the clearest case for partial indexes in the whole schema and the one place the spec's own NFR7 control band depends on the index choice.

Also: cap each branch of the union with its own `LIMIT` before concatenating. An unbounded five-way `UNION ALL` after three days away from the queue is exactly the moment the Admin surface needs to still load.

### `deliveredOfferCount` has no recomputable source of truth — add `offer.delivered_at`

The counter is denormalized onto `CapabilityProfile` and incremented by `deliverOffer`. The skill's rule is that a denormalized column names what keeps the copies in agreement. Here nothing can, because **`Offer.state` moves past `delivered`**: once an Offer goes `delivered → accepted`, `COUNT(*) WHERE state='delivered'` no longer counts it. So a drifted counter cannot be rebuilt from any query, and the fairness ordering NFR21 promises degrades silently and permanently.

A nullable `delivered_at TIMESTAMPTZ` on Offer fixes this and pays for itself three more times:

- the counter becomes `COUNT(*) WHERE capability_profile_id = ? AND delivered_at IS NOT NULL` — recomputable, so a reconciliation job is possible and drift is detectable;
- **NFR21 is currently unmeasurable without it.** "Over any rolling 7-day window in which N profiles are published and M Offers are **delivered**" needs a delivery timestamp. `sent_at` is not it — the review queue puts up to 24h between them;
- NFR7's "age of the oldest undelivered Offer" is `MIN(created_at) WHERE delivered_at IS NULL`, which is the same partial index as above.

### Primary keys: `uuidv7()` where an id reaches a URL, and note what `BIGINT` would cost

`pk-strategy` is `UNSET` and this spec has to settle it. Postgres 18 ships `uuidv7()` natively — **and PGlite 0.5.7 is 18.3, so it exists at the test seam too**, with no extension divergence. Two consequences worth stating:

- `/propuesta/[id]` puts a primary key in a URL. A `BIGINT IDENTITY` there publishes the platform's total Offer count to every Hirer on his first Offer, which for a launch-stage product is a number you cannot retract, and it hands an enumerator a clean `/propuesta/1..N` sweep. Authorization stops the read; it does not stop the existence oracle unless every refusal is byte-identical to a genuine 404.
- `uuid-ossp` is in the verified-supported list but is **not needed** — the builtin `uuidv7()` covers it. Don't create an extension the schema doesn't use.

Recommend `uuidv7()` for every entity whose id crosses to a client or appears in a route, and note that pure join tables (`profile_skill`) want a composite natural PK rather than a surrogate at all.

### Say where validation is authoritative

Two authorities will describe every column: the Zod/Drizzle parse at the Server Action boundary ("parses the whole payload into typed values at the boundary, once") and CHECK constraints in the database. The honest split, and the one to write down: **the boundary parse is what produces `fieldErrors` for a person; a CHECK is a backstop that must never fire, and when it does the answer is a 500, not a field error.** Use `CHECK (col IN (...))` over `TEXT` rather than Postgres `ENUM` for `city`, `photo_state`, `state`, `offer_sending_state`, `email_status` — adding a fourth municipality later is then a constraint change instead of a type alteration, and the engine skill prefers it for exactly this reason. `TIMESTAMPTZ` everywhere; never bare `TIMESTAMP`, in a product that spans `America/Bogota` and "anywhere in the world".

---

## Risks

### `state='deleted'` and the hard-delete path are two deletion mechanisms wearing one name

`soft-delete` is `UNSET`, and the draft ships both answers without noticing. `CapabilityProfile.state` includes `deleted` — a tombstone — while story 13's `deleteAccount` "removes the profile, photo, Skills, work history, contact data and sessions" and NFR17 purges. The unresolved question is concrete: **does a row at `state='deleted'` still hold her phone number?**

- If yes, "delete my account" is materially false under Ley 1581 and the real deletion is the 12-month purge — which is a statement the deletion surface would have to make and currently contradicts.
- If no, `deleted` is unreachable and should come out of the enum.

There is a second-order consequence either way: `account.email` is `citext UNIQUE`. A hard delete frees the address and she can return; a tombstone means she can never re-register with her own address. And if deletion anonymizes the email in place, the placeholder must still be unique per row or **the second account deletion collides with the first** on the unique index.

Recommend splitting the two so they never look like one mechanism: `taken_down` is moderation and is a soft state; the data subject's own deletion is a hard delete plus an in-place reduction of the ContactExchange snapshot; `deleted` leaves the profile enum.

### The retention numbers are per-table but the foreign keys are a graph, and they contradict each other

NFR17 sets: Offers 12 months **from send**; ContactExchange 12 months; Reports **24 months**; Account/profile 12 months from last sign-in. The FK graph is `report → offer`, `contact_exchange → offer`, `check_in → contact_exchange`. Three dangling references follow directly from those numbers:

- **A Report outlives its Offer by 12 months.** At month 13 the Admin opens a Report and the Offer body it is about is gone — so the one artifact that made a pattern-across-time worth keeping is unreadable. Either Reports pin their Offer against the purge, or a Report snapshots the body (which silently extends the Offer's retention to 24 months under another name and needs its own classification), or the record is deliberately reduced to metadata and the spec says so.
- **An Offer sent in January and accepted in June:** the Offer purges at January+12, the exchange lives to June+12. `contact_exchange.offer_id` dangles for six months.
- `check_in` hangs off an exchange that may itself have been reduced to counts.

Retention has to be stated **per graph with a purge order**, not per table. This also decides `ON DELETE` behaviour on every one of those FKs, which the spec currently leaves unstated everywhere.

### `photoKey` is one column with two classifications, and NFR6 rests on it being unguessable

The spec calls "an approved `photoKey`" `public` and is silent on a pending one. That makes the column's classification depend on the value of a sibling column — precisely the shape a static classification cannot express, and the failure it produces is NFR6's ("**0** unmoderated photos reachable from any public or indexable surface at any time") going false without any code changing.

Two things follow, both concrete:

- **`photoKey` is `personal`, always.** The *public URL* is derived only when `photo_state='approved'`. That way "which URL do I render" is a projection question governed by the same whitelist discipline as ADR-0003, not a caching accident.
- **The key must be unguessable.** If the object is at `profiles/<profile_id>.jpg` and the profile id is in the public slug or the URL, an unreviewed photo is one string concatenation away from public, and NFR6 becomes an assertion about our routing rather than about reachability. Random key, or a proxied route that reads `photo_state` per request.
- A **rejected** photo's object must be *deleted from storage*, not merely state-flipped. Object storage is a second store with its own retention, and NFR17's purge currently names rows only. "Deleted" has to mean rows, objects, and (once a drain exists) logs.

### NFR15's "**0** further requests" is not achievable under READ COMMITTED as the design is written

`reportOffer` writes the Report and sets `offer_sending_state='frozen'` in one transaction — good, and it correctly refuses to be a background job. But the *other* side of the race is `sendOffer`, which "authorizes, checks `offerSendingState`... and writes an immutable Offer". Under Postgres's default READ COMMITTED, `sendOffer` reads `active`, the Report transaction commits `frozen`, `sendOffer` inserts. An Offer is sent by a frozen Hirer, and NFR15's bound of zero is violated by a normal interleaving — not an exotic one, since a Report and a burst of Offers from the same abusive Hirer is the *expected* shape of the incident.

The fix is a row lock (`SELECT offer_sending_state FROM account WHERE id = ? FOR UPDATE` inside `sendOffer`'s transaction) or `REPEATABLE READ` with retry. Same shape on `acceptOffer`: two concurrent accepts, or accept racing report. There, add the cheap belt to the transactional braces — **`UNIQUE (offer_id)` on `contact_exchange`**, so a double-accept is a constraint violation instead of two exchanges and two sets of contact details crossing.

**Seam 2 cannot catch any of this.** The spec is honest that PGlite is single-connection, but it attributes the gap to "connection pooling, concurrent transaction contention, and PlanetScale's network behaviour" and files it under DD6/DD9. The specific loss is sharper than that: **the NFR15 bound is the thing PGlite structurally cannot test**, and it is the NFR whose failure hurts a Worker directly. Name it as a known limit of that seam and put the lock in the design rather than leaving it to be discovered.

### Better Auth's `verification` table gains a hand-added column, and `drizzle-kit generate` will drop it

Story 1 records the shared-device choice "against the pending verification". `@repo/db` owning Better Auth's schema so migrations have one owner is the right instinct — but the consequence is that a hand-added column on a vendor-owned table is invisible to Better Auth's own schema generator, and the next regeneration produces a migration that **drops it**. The freeze is silent: sessions revert to the 30-day default, and a borrowed phone keeps her account.

Use Better Auth's `additionalFields`/plugin mechanism so the extra column is part of the generated schema, or keep the choice in a table this project owns keyed by the verification identifier. Either way, every Better Auth upgrade becomes a schema-diff review — say so, because that is a standing cost the "one owner" decision buys.

### Block cannot mean what `CONTEXT.md` says it means, given a public Wall

`CONTEXT.md` (binding vocabulary): "her CapabilityProfile becomes invisible to him". The Wall and `/perfiles` are public, indexable, and readable **signed out**, so a Blocked Hirer sees her card by opening the site in a private window. The design can honour "he can send her nothing" and "he cannot open her gated profile"; it cannot honour invisibility, and a Worker who believes it can is relying on a protection that does not exist — which is the exact failure mode story 11 exists to prevent.

There is a schema consequence too: **`Block` survives the Hirer's account deletion only if deletion is soft.** With a hard delete freeing the email, he re-registers with the same address and the Block is gone. That is a real outcome to state rather than discover.

### The cache boundary and the Block filter

`remote-cache-handler` is `none` and there is one Fly machine, so `revalidateTag`'s cross-instance problem does not bite today — worth the spec saying that explicitly, along with the fact that **a second machine reintroduces it** and there is then no `refreshTags()` handler to carry the fix.

Two ownership points the draft leaves open:

- **The cached `/perfiles` read cannot apply the Block filter**, because a `use cache` scope cannot read `cookies()`. So the cached function returns the unfiltered public set and Block is applied in the dynamic wrapper. Write that down; the alternative — passing `accountId` as an *argument* to a cached function — compiles perfectly and is a cross-user leak on a shared key.
- That is also the hole in **NFR9's stated mechanism**. "A gated read cannot compile inside a cached scope because it reads `cookies()`" is true only for reads that call `cookies()`. A cached function taking an account id as a parameter is the leak the compiler will not catch, and the whitelist test NFR9 also names is the real control. Lean on the test, not the compiler.
- **`deliverOffer` changes the `/perfiles` ordering and nothing revalidates it.** Story 2 revalidates the Wall tag on publish; nothing revalidates on delivery or on the rotation job. NFR21's spread bound is then measured against an ordering the site is not serving. Both the Admin delivery path and the rotation schedule need to invalidate the list tag.
- **The rotation must not read the clock inside a cached function.** `pino` stamping `time` is already documented in `CLAUDE.md` as failing `next build` with `blocking-prerender-current-time`; a time-derived shuffle inside `use cache` hits the identical wall. Another reason the rotation belongs in a stored column written by a job.

### Skills are rendered on every card — the N+1 is on the p95-bound path

`PublicProfile` carries `skills[]`, and NFR2 promises p95 ≤ 400 ms server-side with a cold cache. A per-card query for skills is N+1 against a paginated list. PlanetScale `us-east-1` and Fly `iad` are the same metro (~1–3 ms), which is what makes 400 ms plausible *at all* — but it makes it plausible for a handful of round trips, not for one per card. One query with the skills aggregated (`json_agg` over a lateral, or a single `IN` fetch joined in memory) is the shape; `profile_skill (capability_profile_id, skill_id)` and its reverse are both needed.

### The Skill seed is described two ways

Testing Decisions step 1 runs the committed migrations **and then** seeds the Skill vocabulary as a separate act. If the seed is not itself a committed migration, the test vocabulary and the production vocabulary drift, and NFR20's "≥95% of the **seeded vocabulary**" is measured against a fixture production never had. Make the seed an idempotent migration (`INSERT ... ON CONFLICT (slug) DO NOTHING`), which also composes correctly with `promoteSkill` writing the same table at runtime — and which is exactly the reason the spec gave for running committed migrations against PGlite in the first place. `slug` is the natural unique key here, not `id`.

### Smaller, but each is a real gap

- **`slug` is in the API contract and in `PublicProfile` but not in the `CapabilityProfile` entity.** Who generates it, is it unique, is it stable across profile edits (a changed slug breaks every link a Hirer saved), and what is it derived from — because a slug derived from her full name would reverse ADR-0009 in a public, indexable URL.
- **`WorkHistoryEntry` says "Ordered" with no ordering column.** Add `position INTEGER NOT NULL` with `UNIQUE (capability_profile_id, position)`, or ordering silently falls back to insertion order and an edit reorders her history.
- **`offer_sending_state='banned'` has no action that sets it.** `unfreezeHirer` and `resolveReport` exist; nothing bans. Add the action or drop the value.
- **`Offer.state='expired'` has nothing that expires it.** More broadly, this design implies **four scheduled jobs — retention purge, band rotation, offer expiry, the seven-day check-in — and names no scheduler.** The data consequence is that `expired` is unreachable and the counter never settles; the rest is operability's.
- **Session and Verification carry no classification and no retention.** Session tokens and magic-link tokens are `secret` and appear in neither NFR17's retention list nor NFR18's logging bound. Whether Better Auth stores the session token hashed at rest is worth verifying against the pinned version, because unhashed it makes one database read equal to session hijack of every Worker.
- **NFR16 is not answerable from the schema as drawn.** A *consulta* on a 10-business-day clock means "everything we hold about this person" — a subject-access export spanning every table holding a `personal` column. The Consent row proves we were *authorized*; it does not produce the export. Recommend the export be built from the same whitelist mechanism as the three projections, so that a new `personal` column omitted from the export is the same class of bug ADR-0003 already guards against, caught by the same kind of sentinel test NFR10 describes.
- **"10 business days" needs a business-day calendar.** Colombia has ~18 public holidays and `America/Bogota` is UTC-5; nothing in the design computes this, and it is the kind of thing that gets improvised at Build.
- **`phone` normalization.** Store E.164 (`+57…`). It crosses at Contact Exchange into an email a person dials, and a non-unique index on the normalized value is what makes "one phone number published five profiles" answerable by the Admin. That is a moderation signal, not a verification gate, so it stays inside ADR-0008.
- **Migrations must run over port 5432, not PgBouncer's 6432.** PlanetScale's pooler is transaction-pooling mode: DDL, long transactions, and session state belong on the direct connection. That means `@repo/db/migrate` and `@repo/db/client` need **two different connection strings**, hence two env vars, and NFR23 requires both in `turbo.json`. Transaction pooling also removes `LISTEN/NOTIFY`, session advisory locks, temp tables, and cross-transaction prepared statements — which constrains the scheduler design (no advisory-lock single-runner) and is the specific thing that breaks when the machine count goes from one to two. Pinning `pg` rather than `postgres.js` is the right call here for exactly this reason (`postgres.js` prepares by default); worth saying *why* it was chosen rather than leaving it as a version pin.

---

## Concerns

- [ ] **D1** — `state='deleted'` on CapabilityProfile versus the hard-delete path in story 13. Whether a soft-deleted row still holds her phone number. **Risk if wrong:** "delete my account" is materially false under Ley 1581 while the site tells her it is true, and re-registration with her own email is impossible. **Owner:** Data lead (with Security owner). **Unblocks by setting:** `docs/policy/data.md` → `soft-delete`.
- [ ] **D2** — Primary key type, given that `/propuesta/[id]` puts one in a URL. **Risk if wrong:** a sequential id publishes the platform's total Offer volume to every Hirer and hands an enumerator a clean sweep. **Owner:** Data lead. **Unblocks by setting:** `docs/policy/data.md` → `pk-strategy`.
- [ ] **D3** — Migration reversibility, and whether PlanetScale branches plus deploy requests are the mechanism. Drizzle generates one-way SQL by default and the spec never names a rollback path for schema. **Risk if wrong:** the ≤5-minute rollback NFR24 promises covers the app and not the database, so the one deploy that needs undoing is the one it cannot undo. **Owner:** Data lead. **Unblocks by setting:** `docs/policy/data.md` → `migration-policy`.
- [ ] **D4** — `orm` is `UNSET` while the spec pins `drizzle-orm@0.45.2` and commits Drizzle migrations. **Risk if wrong:** low as a decision, certain as a recurrence — the next spec raises the same question. **Owner:** Data lead. **Unblocks by setting:** `docs/policy/data.md` → `orm`.
- [ ] **D5** — Backup RPO and RTO for a single Postgres holding displaced people's phone numbers, with `on-call-rotation` = nobody and no second copy anywhere in the design. Object storage for photos is a second store with its own answer. **Risk if wrong:** the failure that ends the platform is unrecoverable and nobody finds out how much was lost until they need it. **Owner:** Data lead. **Unblocks by setting:** `docs/policy/data.md` → `backup-rpo` / `backup-rto`.
- [ ] **D6** — Retention stated per FK graph rather than per table, with a purge order. NFR17's numbers leave `report.offer_id` and `contact_exchange.offer_id` dangling. **Risk if wrong:** a 13-month-old Report is about an Offer nobody can read, which removes the entire reason for the 24-month number. **Owner:** Data lead (with the *responsable del tratamiento*). NFR17 also has to be **written back** into `docs/policy/data.md` → `retention-personal`/`retention-internal`/`retention-logs` in this effort, per the intent.
- [ ] **D7** — What "reduced to non-identifying counts" retains, on both paths that reach it (deletion under NFR11, and the 12-month reduction under NFR17). At three municipalities and launch-scale volume, `(city, skill, month, work_happened, was_paid)` may still re-identify. **Risk if wrong:** a record we told her was anonymized identifies her. **Owner:** Data lead with Security owner.
- [ ] **D8** — Whether the *prueba de la autorización* (the Consent row) survives the purge of the Account it authorizes. **Risk if wrong:** the evidence that we were permitted to hold her data is destroyed while a 24-month Report about her survives. **Owner:** the *responsable del tratamiento* (repo owner personally, per intent Q4).
- [ ] **D9** — Whether Better Auth stores session tokens hashed at rest, verified against the pinned version. **Risk if wrong:** one database read is session hijack of every Worker, and NFR13's revocation surfaces do not help. **Owner:** Security owner (raised here because the columns are in `@repo/db`'s schema).

---

## Handoffs

- **security-design** — four of these are one concern seen from both edges: the Block filter's position relative to the `use cache` boundary (a cached function taking an account id compiles and leaks); `photoKey`'s classification and unguessability, which is what NFR6 actually rests on; what "non-identifying counts" retains (D7); and session-token storage (D9). NFR9's compiler argument has a hole that only a whitelist test closes — that is the same test security will want.
- **operability-design** — **four scheduled jobs are implied and none is named**: retention purge, band rotation, Offer expiry, seven-day check-in. Transaction pooling removes session advisory locks, so the usual single-runner guard is unavailable; on one machine that is fine and on two it is not. Also: schema migrations have no stated rollback while NFR24 promises a ≤5-minute undo, and a one-way migration needs a forward fix rather than a rollback (D3). And the Admin queue's `MIN(created_at)` per screen (story 22) is the control band's own measurement — it is an index question and an operability signal at once.
- **simplicity-design** — I have recommended adding columns (`delivered_at`, `rotation_key`, `position`, `search_text`, `slug`) and roughly a dozen indexes. At launch volume — a few hundred profiles — almost none of the indexes matter, and I would rather the architect ship the five partial indexes on the Admin queue, the FK indexes, and the two uniques, and defer the rest. The *columns* are the part that is hard to add later; the indexes are not. Do not read this advisory as a case for indexing everything named above on day one.

---

## Not applicable

- **Expand–contract.** Nothing exists to migrate. Every table in this effort is a first creation, so no rename, no type narrowing, no `NOT NULL` without default, and no change of meaning applies *within* this effort. Checked deliberately, because it is the finding a data lens usually produces and its absence here is real rather than an oversight.
- **Sharding / Vitess / Neki.** Three municipalities, one Fly machine, `remote-cache-handler` = none. Nothing in the access patterns approaches a single-node limit and nothing should be designed against one.
- **Partitioning.** Considered for `offer` given a 12-month retention window — a monthly-partitioned table makes the purge a `DETACH` instead of a `DELETE`. Rejected: at this volume the purge is a trivial `DELETE` and partitioning would complicate every FK in the graph, which is exactly where D6 already hurts.
- **Cross-instance tag invalidation / `refreshTags()`.** Genuinely absent today with one machine, and named above only as what a second machine reintroduces.

## What I could not check

- **The deep dives do not exist yet.** DD1, DD3, DD5, DD6, DD8, DD9 and DD11 are all referenced by the high-level design and are empty pending Phase C. Cache boundaries, object storage, connection pooling, sessions and CI may already be headed somewhere that answers several findings above — I read the draft as written and could not tell.
- **No volume numbers anywhere.** Not in the spec, not in the intent. Every index recommendation above is shape-correct and none is sized, because there is no N and no offers-per-day to size it against. That absence is itself worth an NFR: NFR2 promises a p95 and NFR21 promises a spread bound, and neither states the population it holds over.
- **The Skill vocabulary's size and shape.** CIUO-08 A.C. versus SENA is still open per intent Q2, and the row count is what decides whether trigram versus FTS is a real choice or a coin flip. I could not size the `skill` table.
- **Better Auth 1.7.1's actual schema** — table names, whether it indexes `session.account_id`, its token-hashing behaviour, and whether `additionalFields` covers the shared-device column. All three matter to findings above and all three need reading against the pinned version, not against recall.
- **PlanetScale's dashboard extension enablement.** `citext`, `pg_trgm` and `unaccent` are confirmed supported, but the engine skill notes some extensions must be enabled in the dashboard (Clusters → Extensions) before `CREATE EXTENSION` works, sometimes requiring a restart. Whether these three need that step is a provisioning fact I could not verify, and it belongs in the go-live runbook if they do.
- **Whether any advisory from another lens contradicts this one.** I am isolated by design and have not seen the security, operability, or simplicity advisories.
