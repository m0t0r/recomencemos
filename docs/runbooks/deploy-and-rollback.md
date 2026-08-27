# Runbook: deploying, and undoing a deploy

What a human does to ship Recomencemos, and what they do at the moment they wish they had not.
It is the procedure behind [spec 0002](../efforts/0002-profile-to-contact-exchange/spec.md)'s DD10
and NFR25, and it assumes the app has already been provisioned by
[`recomencemos-go-live.md`](recomencemos-go-live.md) §§1–5.

**The premise, and everything below follows from it:** `on-call-rotation` is **nobody**. NFR25's "≤ 5
minutes" describes a rollback by a person who has noticed, and there is no such person at 03:00. So
the mechanism that matters is not the rollback command — it is the **health gate**, which is the only
rollback that runs without anyone watching.

---

## 1. Deploy

**Normally you do not run a command at all.** `main` is the release branch and `dev` is the default
one: a ticket's PR merges into `dev`, and deploying means **promoting `dev` to `main`**.

```sh
gh pr create --base main --head dev --title "release: promote dev"
```

Merging that PR runs `.github/workflows/deploy.yml`, which calls `ci.yml` as a reusable workflow —
the same five jobs a pull request had to pass, re-run on the commit actually being deployed — and
only then deploys. `docs/policy/build.md` → `release-branch` is the key; the spec's NFR25 carries the
reasoning and the amendment that put it there.

**The terminal path still exists and is the same script**, which is the point: CI invokes
`scripts/deploy.sh` rather than restating what a deploy is, so the two cannot diverge. Running it by
hand needs a reason, and it refuses any branch but `main` unless you say so:

```sh
# From `main`, when CI itself is what is broken:
NEXT_PUBLIC_SENTRY_DSN=… SENTRY_ORG=… SENTRY_PROJECT=… SENTRY_AUTH_TOKEN=… ./scripts/deploy.sh

# A deliberate rehearsal from a branch — proving the health gate aborts a bad build, say:
DEPLOY_ALLOW_BRANCH=1 ./scripts/deploy.sh
```

`scripts/deploy.sh` refuses a dirty tree, a branch that is not `main`, and a `HEAD` that is on no remote branch, sets
`NEXT_PUBLIC_RELEASE` from the commit SHA, and passes the Sentry token as a **build secret** rather
than a build argument — a build argument is recorded in the image's history and readable by anyone who
can pull it.

Everything else is `fly.toml`, and three lines in it carry the whole design:

| Line                                           | What it buys                                                                                                                                                                                           |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `[deploy] strategy = "bluegreen"`              | The new machine comes up beside the old one and takes traffic only once its checks pass. On one machine a rolling deploy is a stop and a start — a small outage several times a day                    |
| `release_command = "node /migrator/…/cli.ts"`  | Migrations run **before** any machine is replaced, on the **direct** connection. A failed migration aborts the deploy with the old machine still serving; the same failure at boot takes the site down |
| `[[http_service.checks]] path = "/api/health"` | The check makes a real database round trip. Fly's default degrades to TCP-accept, which succeeds while every route returns 500 — so without this a build with a bad `DATABASE_URL` deploys clean       |

**What a healthy deploy looks like:** the release command prints `migrations applied`, then the new
machine's checks go green, then traffic moves. **What an aborted one looks like:** `fly deploy` exits
non-zero, and `fly status` still shows the previous machine serving.

---

## 2. The three rollback classes

"≤ 5 minutes" is true for one of these. Naming the other two is the point of this section — a single
number invites the assumption that everything is undoable at that price.

| Class                  | What it is                                                        | Cost to undo                                                                                                                    | How                                |
| ---------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| **Code-only**          | A code or config change with no migration                         | **≤ 5 minutes** (NFR25), measured — see §3                                                                                      | §3                                 |
| **Additive migration** | A migration that only adds — a column, a table, an index          | The same as code-only. **The column stays**, and that is deliberate: rolling the schema back is what would break the older code | §3. Do not roll the migration back |
| **A completed send**   | An email is in an inbox; a phone number is on a stranger's screen | **One-way. There is no undo at any price**                                                                                      | §4                                 |

**A contracting migration is not on this list, because it may not ship in a deploy that could need
rolling back.** DD10 requires expand/contract: a migration that drops or renames travels in its own
deploy, alone, after the code that stopped using the column has shipped and stayed up. Ship the two
together and rolling the code back leaves a schema the old build does not understand — which is
exactly where the five minutes stops being true. `scripts/migration-integrity.mjs` enforces this and
`pnpm migrations:check` runs it against this repository on every PR.

**`fly secrets set` restarts the machine, so a configuration change is redeploy-class too.** There is
no feature-flag mechanism in this repository, so "put it behind a flag" is _unavailable_ rather than
unchosen.

---

## 3. Rolling back code

Two commands, verified against `flyctl` v0.4.94.

```sh
fly releases --image --json          # read the previous release's image reference
fly deploy --image <ref> --strategy immediate
```

`--strategy immediate` and not bluegreen: the previous image is a build that was already serving
traffic and already passed its checks, so waiting for a second opinion spends minutes buying nothing.
This is the one place a strategy is passed on the command line.

**Measured, not asserted.** Rehearsed against production on 2026-08-27, `flyctl` v0.4.94:

|                                              |                                        |
| -------------------------------------------- | -------------------------------------- |
| Wall clock, command to complete              | **33 s**                               |
| NFR25's bound                                | ≤ 5 minutes                            |
| Public `GET /api/health` during the rollback | **22 consecutive 200s**, polled at 1 s |

No failed probe was observed, which is not the same as proving zero downtime at that granularity —
a sub-second gap would not appear in a 1 s poll. What is proven is that the code-only class sits an
order of magnitude inside its bound.

**After any rollback**, open a `needs-triage` issue naming the release that was rolled back and what
was observed. [ADR-0001](../adr/0001-findings-enter-through-triage.md) is why the finding enters
through triage rather than becoming a ticket directly.

---

## 4. When the thing to undo is a send

A send is the one irreversible act in this system, and its forward fix has to exist before it is
needed rather than be improvised afterwards.

1. **Stop the bleeding.** `fly secrets set NOTIFICATIONS_KILL_SWITCH=on`. Every send is refused,
   logged, and never delivered. The machine restarts, which is a few seconds — cheaper than any
   alternative. Empty, `off`, `false`, `0` and `no` leave sending on; _everything else engages it_.
2. **Enumerate the blast radius.** Every send emits one `info` line carrying `exchange_id` and the
   recipient's **id**, never their address (NFR18). Query the drain for `notification.sent` over the
   window. **Without that line the affected set is not even knowable**, which is why it is in the
   design rather than in this document.
3. **Decide whether to notify**, which is a `docs/policy/` question and not one this runbook answers:
   the classification of what was disclosed is in [`../policy/data.md`](../policy/data.md), and
   [`../policy/security.md`](../policy/security.md) → `incident-contact` names who is told.
4. **Turn sending back on deliberately** — `fly secrets unset NOTIFICATIONS_KILL_SWITCH` — and record
   in the triage issue what was fixed first.

---

## 5. NFR32's arithmetic, and when to stop deploying

**The target: 99.5% monthly on `/` and `/profiles`**, measured by the external uptime monitor and not
server-side, because a machine that is down measures nothing.

Over a 30-day month that is a budget of **216 minutes** — 0.5% of 43,200 — or **3 h 36 m**.

**What the deploy cadence spends against it:**

| Strategy      | Per deploy                                            | At ~10 deploys/day, 30 days | As a share of the month | Achievable ceiling         |
| ------------- | ----------------------------------------------------- | --------------------------- | ----------------------- | -------------------------- |
| **Rolling**   | ~30 s of boot, hard down                              | ~150 min                    | **~0.35%**              | ~99.65%                    |
| **Bluegreen** | 0 — the old machine serves until the new one is green | 0                           | **0%**                  | Bounded by incidents alone |

That is the whole argument for bluegreen being a requirement rather than a preference: rolling deploys
alone consume **70% of the budget** and leave ~66 minutes a month for every real incident. NFR32 is
settleable only because DD10's bluegreen is.

**The control band (C11).** Above **50% of the 30-day budget — 108 minutes** — deploys are limited to
fixes and cadence drops to **once daily** until the trailing window recovers. This is a rule about
what a human may do, not an automated gate; the number it is measured against comes from the uptime
monitor, not from the app.

---

## 6. Two numbers from the first deploy, worth keeping

- **`max_connections` is 25.** Read out of the running cluster, and it is the number
  [`recomencemos-go-live.md`](recomencemos-go-live.md) §2 calls _"the one number effort 0002 could not
  verify at Design"_. DD2's pool cap is **10 per machine**, and those ten are client connections to
  **PgBouncer** on 6432 rather than backends on Postgres, so one machine sits comfortably inside it.
  What to watch: the **direct** connection consumes a real backend, and PlanetScale's own processes
  (Patroni's heartbeat and REST API, the metrics exporter) hold several more. Adding machines is the
  thing that makes this number bite.
- **The cluster's memory sits at ~26% at rest, and that is `shared_buffers`.** Measured:
  `shared_buffers` is 159 MB against an `effective_cache_size` implying ~640 MB of cluster RAM.
  Postgres allocates that pool in full at startup and holds it, which is why the utilisation graph is
  a step at cluster creation and flat afterwards rather than a curve that tracks traffic. It is **not**
  the health check: that is `select 1`, 4–6 ms, about **0.08 queries per second** across Fly's 15 s
  probe and the uptime monitor's 60 s one. Anyone reading that graph as load — as we did first — will
  reach for the round trip, which is the one thing holding the deploy gate up.

---

## 7. What is not here yet

- **The uptime monitor** itself — probing `/api/health` every 60 s and alerting after 2 consecutive
  failures — is [`recomencemos-go-live.md`](recomencemos-go-live.md) §5. With nobody on call,
  detection latency is the entire mitigation, so a deploy runbook without it is only half a story.
- **`alert-destination`** and the rest of §§5b–11 are that runbook's, and are tracked by
  [#36](https://github.com/m0t0r/recomencemos/issues/36).
