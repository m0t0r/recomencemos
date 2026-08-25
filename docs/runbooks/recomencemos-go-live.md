# Runbook: taking Recomencemos live

Everything a human has to do — in a vendor dashboard, at a terminal, or on paper — between the first
deploy and the announcement. It is the other half of
[`observability-go-live.md`](observability-go-live.md), which covers error reporting and logs and is
still required; this document covers the product's own infrastructure, its credentials, its legal
surface, and the sending domain.

**It exists because effort
[`0002-profile-to-contact-exchange`](../efforts/0002-profile-to-contact-exchange/spec.md) answered
fifty-seven flagged concerns and sixteen of the answers ended in a step only a person can perform**
— plus DD10's scheduler, decided after that review and added here in §5b, and §11, added when the
second review pass (C50) found NFR2's user-measured number had no instrument.
Each one names the concern it discharges, so a reader can go back to the reasoning rather than trust
the instruction.

**Where a step ends in a decision, it names the `docs/policy/` key rather than making it.** Effort
0002 set most of those keys; the two still open are marked where they bite.

> **Nothing here is done yet.** Every checkbox in this document is unticked on purpose. The ticket
> that executes it is the runbook ticket named in the spec's **Runbook obligations** section.

---

## 1. Credentials — eight, and where each lives (C5, C43, DD10)

`secret-store` is **`fly secrets`, mirrored in the operator's password manager**. No secret reaches a
repo `.env` file: `turbo.json` declares `.env*` a `build` input, so the file's content is hashed into
the cache key and travels with the artifact under remote caching.

| #   | Secret                                   | Issued from                         | Rotation                             | Notes                                                                                                                                                                      |
| --- | ---------------------------------------- | ----------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | PlanetScale **app** connection string    | PlanetScale → database → Connect    | Rotate the password; redeploy        | The pooled connection the app runs on                                                                                                                                      |
| 2   | PlanetScale **direct** connection string | Same                                | Same                                 | Migrations, and the C43 break-glass. Higher blast radius than #1 — treat as the most dangerous string in the list                                                          |
| 3   | `RESEND_API_KEY`                         | Resend → API Keys                   | Create new, deploy, delete old       | Sending-scoped, not full access                                                                                                                                            |
| 4   | Resend **webhook signing secret**        | Resend → Webhooks                   | Rotate at the endpoint               | Without it a forged bounce is an account-denial primitive                                                                                                                  |
| 5   | R2 access key + secret                   | Cloudflare → R2 → Manage API tokens | Create new, deploy, delete old       | Scope to the one bucket                                                                                                                                                    |
| 6   | Google OAuth **client secret**           | Google Cloud console → Credentials  | Rotate; existing sessions unaffected | The redirect URI must match the deployed origin exactly                                                                                                                    |
| 7   | `BETTER_AUTH_SECRET`                     | `openssl rand -base64 32`           | **See the warning below**            | 32+ chars. Better Auth rejects placeholders in production                                                                                                                  |
| 8   | `JOB_SHARED_SECRET`                      | `openssl rand -base64 32`           | Rotate in both places at once        | The only thing Trigger.dev holds. Set identically as a Fly secret **and** as a Trigger.dev environment variable — rotating one without the other stops every scheduled job |

```sh
fly secrets set DATABASE_URL='…' RESEND_API_KEY='…'      # restarts the machine — a deploy-class act
fly secrets list                                          # names and digests only, never values
```

- [ ] All eight set with `fly secrets` (#8 also in Trigger.dev's environment)
- [ ] All eight mirrored into the password manager — a lost machine must not be a lost platform, and
      **#3 and #5 are not recoverable from Fly**, only replaceable
- [ ] No `.env` file in the repo contains any of them (`git grep -nE '(RESEND|DATABASE_URL|BETTER_AUTH)'`)

> **Rotating `BETTER_AUTH_SECRET` invalidates every Admin second factor.** It encrypts TOTP secrets
> and backup codes at rest. Rotation is an operational event with a recovery step attached (§6), never
> a routine hygiene task.

---

## 2. Database (C35, C17, C23)

- [ ] **Connection limit read from the plan** and confirmed to sit above the pool cap of **10 per
      machine** that DD2 sets. This is the one number effort 0002 could not verify at Design.
- [ ] `citext` and `pg_trgm` available — `CREATE EXTENSION` succeeds, or the dashboard toggle that
      makes it succeed has been found. NFR21's Spanish search and the `citext` unique email both
      depend on it.
- [ ] **Backup retention set to 7 days**, matching `retention-backups`. The deletion copy a Worker
      reads promises exactly this number, so the vendor setting and the sentence must agree.
- [ ] **One real restore rehearsed** against a scratch database, timed, before the announcement:
      RPO ≤ 1 h and RTO ≤ 4 h are unproven until this runs once.
      **Restore both stores together** — a recovered `photoKey` pointing at an R2 object that is gone
      is a half-recovery nobody notices until a Worker does.

---

## 3. Object storage (DD6)

- [ ] Bucket created, with a **quarantine prefix that is not publicly readable**. NFR6 bounds the
      stored object, not the page: a pending photo at a readable URL that nothing links to defeats
      the rule while appearing to satisfy it.
- [ ] Domain on Cloudflare as a zone, with **image transformations enabled** — a dashboard step, and
      photos serve at full size until it is done.

---

## 4. Sending domain — start this first (C45)

**This is the step with a lead time, and the only one that cannot be compressed at the end.** Warm-up
guidance for a new domain is 50–100 sends/day in week 1 and 200–500 in week 2; the announcement is a
spike onto a domain that has never sent anything.

- [ ] Sending subdomain added in Resend, DNS records published
- [ ] **SPF, DKIM and DMARC resolve** — verified with `dig`, not assumed:
      `sh
dig +short TXT <sending-subdomain>              # SPF
dig +short TXT resend._domainkey.<subdomain>    # DKIM
dig +short TXT _dmarc.<root-domain>             # DMARC
`
- [ ] **Warming started at the first deploy, not at the announcement.** Every ticket's test sends
      count toward the curve; there is no separate warming exercise to schedule.
- [ ] **Fallback subdomain held and warmed in parallel**, so a reputation problem on the primary is a
      DNS change rather than a rebuild.
- [ ] **Staged announcement plan written** — who is told on which day — so volume tracks the curve
      rather than outrunning it.
- [ ] **Deliverability measured into real Colombian inboxes**: send to a live `gmail.com` and a live
      `hotmail.com` account and confirm inbox rather than spam, **by eye**.

> This last check is a runbook step and **does not gate the announcement** — decided knowingly at C45.
> Its risk is stated there and repeated here because this is where it lands: it is the check most
> likely to be ticked without being done, and its failure is silent. Sends are accepted, not bounced.
> NFR27's conversion metric is the only thing that would reveal it, after the window has closed.

---

## 5. Application configuration

- [ ] **Machine memory ≥ 1 GB** in `fly.toml` (C34)
- [ ] **CSP shipped and enforced**, not report-only (C6):
      `default-src 'self'; frame-ancestors 'none'; img-src 'self' <image-host> data:; connect-src 'self' <sentry-ingest>; base-uri 'self'; form-action 'self'`
      `frame-ancestors 'none'` is the load-bearing directive — without it `acceptOffer` is
      clickjackable, and that is one click releasing a displaced person's name, phone and email.
      Next's inline bootstrap needs a nonce or `'strict-dynamic'`; this is the directive most likely
      to break the first deploy.
- [ ] **Uptime monitor**: probe `GET /api/health` every **60 s**, alert after **2 consecutive
      failures** (C33). With `on-call-rotation` at nobody, detection latency is the entire mitigation.
- [ ] **Daily digest at 08:00 America/Bogotá** wired through the notification seam, carrying NFR7's
      queue depths and the age of the oldest item (C10)
- [ ] **Machine bands open a `needs-triage` issue from CI** ([ADR-0001](../adr/0001-findings-enter-through-triage.md))

---

## 5b. The scheduler (DD10)

Trigger.dev free tier, verified 2026-08-25: **$5/month of credits, 20 concurrent runs, 10 schedules**,
minute-granularity cron, full IANA timezones, 1-day log retention. Four of the ten slots are used.

**The rule this integration rests on: Trigger.dev never holds a database credential.** Each task body
is one authenticated `POST` to a Route Handler on Fly, so the work runs where the data already is.
That is what keeps the scheduler out of §7's processor list — no personal data crosses to it, so it is
not a _transmisión_ and belongs in no _aviso_. **If a task is ever changed to query the database
directly, §7 has to be reopened before it ships.**

- [ ] Project created; `JOB_SHARED_SECRET` set as a Trigger.dev environment variable, identical to the
      Fly secret
- [ ] Four schedules deployed, each a `POST` and nothing more:

| Task           | Cron        | Timezone           | Calls                         |
| -------------- | ----------- | ------------------ | ----------------------------- |
| `rotation-key` | `0 3 * * *` | UTC                | `POST /api/jobs/rotation-key` |
| `offer-expiry` | `0 * * * *` | UTC                | `POST /api/jobs/offer-expiry` |
| `check-ins`    | `0 9 * * *` | UTC                | `POST /api/jobs/check-ins`    |
| `queue-digest` | `0 8 * * *` | **America/Bogotá** | `POST /api/jobs/queue-digest` |

- [ ] **Each endpoint verified to reject an unsigned call** — `curl -X POST` with no secret returns a
      bodyless `401` and writes one `job.rejected` line
- [ ] **Each verified idempotent**: called twice inside one window, the second call changes nothing
- [ ] Sentry's single free **cron monitor** pointed at `queue-digest` — the one job whose silence
      nobody would otherwise notice, because the other three announce themselves through the product
- [ ] A run that hits its per-invocation cap (500 Offers, 200 check-in sends) emits the line that says
      so, and the backlog is checked after the first week

---

## 6. The Admin, and not being locked out of your own platform (C43, C44)

One Admin moderates everything. Losing the second factor stops every Offer behind NFR7's 24-hour band
and leaves every reported Hirer frozen, because `unfreezeHirer` is an Admin action.

- [ ] First Admin granted by the documented manual `UPDATE` over the direct connection
- [ ] **Ten backup codes printed and stored offline** — on paper, not in the password manager that
      also holds the password
- [ ] **A second Admin account on a separate device**, its own TOTP secret, same person. This is the
      path that recovers the platform in minutes rather than hours
- [ ] **Break-glass rehearsed once**: the `UPDATE` that disables the second factor, run over the
      direct connection (#2 in §1), against a scratch database — so the first time it is run is not
      during the incident
- [ ] `trustDevice` is **`false`** for the Admin (C44). TOTP on every sign-in; six digits a day is the
      price of the account that can read every exchanged phone number

---

## 7. Legal — Ley 1581, and the operator is personally the _responsable_ (C15)

[Intent Q4](../efforts/0002-profile-to-contact-exchange/intent.md) records that the repo owner
personally is the _responsable del tratamiento_, accepted knowingly. DD8 verified that **RNBD
registration does not apply** to a _persona natural_. International transmission is the part that does.

- [ ] **_Aviso de privacidad_ names every processor** with its country and purpose: PlanetScale, Fly,
      Cloudflare, Google, Resend, Sentry
- [ ] **_Autorización_ carries express consent to international transmission**, shown at publish and
      at first Offer send, versioned in the Consent row
- [ ] **Each vendor's DPA / SCCs downloaded and filed** — deferred from Design at C15, and named there
      as the half a regulator asks for first
- [ ] Whether SIC's **Circular Externa 005 de 2017** lists these countries as adequate: checked, and
      the answer recorded. The design does not depend on it — express authorization is taken either
      way — but the answer changes what the filing above must produce
- [ ] The habeas data clock is a **business-day** calendar: Colombia has ~18 public holidays and
      `America/Bogota` is UTC−5. A _consulta_ is 10 business days (+5), a _reclamo_ 15 (+8)

---

## 8. Repository and release (C7, C16)

- [ ] **Required status checks** on the default branch: `lint`, `check-types`, `test` (including
      `test:gates`), `build`, and the dependency audit. **No required reviews** — on a one-person
      repository they lock the operator out or normalize admin bypass
- [ ] Dependency audit fails the build on **`high` or above in a direct dependency** (C7)
- [ ] `gh extension install github/gh-stack` — `stacked-prs` is on for genuine chains, and
      `pr-merge-method` is **rebase**, because squashing a lower PR rewrites the base every branch
      above it was cut from
- [ ] **Rollback rehearsed once against production**: bluegreen, health-gated, ≤ 5 minutes by one
      documented command (NFR25)

---

## 9. Security review before the announcement (C8)

`pentest-cadence` is **none external**, recorded as a decision rather than a silence. What runs in its
place:

- [ ] `/security-review` wired as a `REVIEW.md` pass on every PR touching **auth, the exchange path,
      or an egress**. The path condition is deliberate — a security review on the PR that changes a
      font size teaches the reader to skim
- [ ] **One full `/security-audit` run** against the built system before the announcement, with
      DD16's boundary table handed to it as input so its first phase does not have to infer an
      architecture
- [ ] Findings triaged; anything exploitable on the exchange path closed before the announcement

> Neither is a pentest, and neither is recorded as one. An agent reading code another agent wrote
> shares its blind spots; what these buy is coverage and consistency, not independence.

---

## 10. The announcement gate

Every `Must` ticket closed, **and** all of the following green. This is NFR28's operational leg,
restated as the last checklist a human reads:

- [ ] Log drain collecting (see [`observability-go-live.md`](observability-go-live.md) §9)
- [ ] Uptime monitor firing at 60 s / 2 failures
- [ ] Rollback rehearsed
- [ ] Restore rehearsed
- [ ] Cloudflare transformations on
- [ ] Four schedules live, each rejecting an unsigned call, cron monitor on the digest
- [ ] SPF / DKIM / DMARC resolving, domain warmed to the expected day-one volume
- [ ] Load test shows NFR2 held at its stated concurrency
- [ ] `trace_id` correlation proven end to end
- [ ] Admin backup codes offline, second Admin device working
- [ ] _Aviso_ and _autorización_ live, naming every processor
- [ ] §11's client-side measurement taken and recorded

---

## 11. The number no instrument produces (C50, NFR2)

NFR2 has two numbers and only one of them is monitored. The server-side p95 is on every log line. The
**≤ 1200 ms measured from a Colombian client** is measured **here, by a person**, because this product
ships no analytics and no RUM — the uptime monitor probes `/api/health` and the load test runs against
the machine, so neither of them sees what she sees.

Take it once before the announcement, then **monthly**, and again **after any change to the Wall's
payload or the photo path**.

1. From a real Colombian connection — a phone on mobile data in Pereira is the honest case; a VPN exit
   in Bogotá is the fallback and is recorded as such, because it is a better network than the one being
   measured.
2. Load `/` and `/profiles` cold, five times each, DevTools throttling at **4× network and 4× CPU**.
3. Record, per route: p95 of the five loads, LCP, and the `ping` RTT to the app host — the last one
   settles the 90–110 ms Pereira↔`iad` estimate NFR2 rests on rather than leaving it recalled.
4. Write the three figures and the date into the table below. **A measurement not written down is a
   measurement not taken** — this is the step whose whole value is the previous row.

| Date | Vantage (device / network / city) | `/` p95 | `/profiles` p95 | LCP | RTT |
| ---- | --------------------------------- | ------- | --------------- | --- | --- |
|      |                                   |         |                 |     |     |

**Over 1200 ms is a finding, not a failure of this step.** It becomes a `needs-triage` issue with the
row attached ([ADR-0001](../adr/0001-findings-enter-through-triage.md)); the announcement is not
blocked on it, because nothing here can be fixed on announcement day. **The risk this leaves is
stated**: between two rows of that table a regression is invisible, and the people on the most
constrained connections are the ones who pay for it.

---

## Still open, and where the decision lives

| Question                    | Key                                       | Why it is still open                                                                                                                        |
| --------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| The product's written voice | `docs/policy/ux.md` → `voice-guide`       | `UNSET` **by decision** (C2). A `brand-voice` session sets it, and it blocks the first ticket rendering `es-CO` copy — not Build as a whole |
| Reduced motion              | `docs/policy/ux.md` → `motion-policy`     | Not raised by effort 0002                                                                                                                   |
| Analytics consent           | `docs/policy/ux.md` → `analytics-consent` | Out of scope for 0002 — under Ley 1581 that gate precedes instrumentation                                                                   |
| Coverage floor              | `docs/policy/build.md` → `coverage-floor` | Not raised by effort 0002                                                                                                                   |
