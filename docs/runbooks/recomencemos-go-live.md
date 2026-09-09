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

**§§1–5 have a wizard: [`scripts/go-live.sh`](../../scripts/go-live.sh).** It opens each dashboard,
captures each value, stages the secrets on Fly over stdin, and **runs the verification commands
itself** — the `dig`s, the unauthenticated `curl` at the quarantine prefix, `SHOW max_connections`,
`fly secrets list` — appending each command and its output to a gitignored transcript. That
transcript is what a human pastes onto the ticket, because the ticket's last criterion asks for a
command and its output rather than an assertion that it was done. It is idempotent: stop with Ctrl-C
and re-run, and it resumes from the non-secret facts it wrote. §§5b–11 have no wizard yet and are
walked by hand.

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

**Two buckets, and which bucket an object is in is the whole of NFR6.** R2 states public access as a
**single switch per bucket** — there is no per-prefix ACL and no S3-style bucket policy underneath
it, so "the quarantine prefix is not publicly readable" is a sentence R2 has no mechanism to make
true. It is written here because that sentence stood in this runbook for a while with nothing behind
it ([#251](https://github.com/m0t0r/recomencemos/issues/251)), and because the answer a later reader
reaches for — a WAF custom rule on the zone — is a second mechanism to keep in agreement with a first.
Do not add one and do not put both prefixes in one bucket. `object-store-access` in
[`../policy/data.md`](../policy/data.md) is the key.

- [ ] **Two buckets created.** `PHOTO_S3_BUCKET` holds approved photos; `PHOTO_S3_QUARANTINE_BUCKET`
      holds everything an Admin has not yet decided on. Both names go into `fly secrets` with the
      rest of §1.
- [ ] **The photos bucket has public access enabled**, and a custom domain on the Cloudflare zone in
      front of it — the `/cdn-cgi/image/…` transformation path requires one. That domain is
      `PHOTO_PUBLIC_BASE`.
- [ ] **The quarantine bucket has public access never enabled, and no custom domain at all.** There is
      nothing to switch off and nothing to write a rule against, which is the point: the object is
      unreachable because no public route to that bucket exists, not because a rule declines to serve
      one. NFR6 bounds the stored object, not the page — a pending photo at a readable URL that
      nothing links to defeats the rule while appearing to satisfy it.
- [ ] **Proven, not asserted:** put a known object under `quarantine/` in that bucket, then request it
      with no credentials at the address you would use if it were public. The pass is a **denial** of
      an object that is really there. A `404` for a key nobody wrote proves nothing — that trap is why
      `packages/storage/src/photos.store.test.ts` uploads before it asks, and `scripts/go-live.sh` §3
      now does the same.
- [ ] **A lifecycle rule on the quarantine bucket**, so objects nobody ever reviewed are collected
      rather than kept. `promoteToPublic` deliberately leaves the original in place on approval.
- [ ] Domain on Cloudflare as a zone, with **image transformations enabled** — a dashboard step, and
      photos serve at full size until it is done.
- [ ] Worth having, and not what makes NFR6 true: a Cloudflare **Transform Rule** adding
      `X-Content-Type-Options: nosniff` on the photo origin. Nothing in this repository can set that
      header on a host it does not serve.

---

## 4. Sending domain — start this first (C45)

**This is the step with a lead time, and the only one that cannot be compressed at the end.** Warm-up
guidance for a new domain is 50–100 sends/day in week 1 and 200–500 in week 2; the announcement is a
spike onto a domain that has never sent anything.

**The domain is `recomencemos.online`, and the sending subdomain is `mail.recomencemos.online`.**
Both are real as of 2026-08-27, which is why the first two boxes below are ticked and the rest are
not — the clock on the warm-up curve started when the subdomain verified, not when this section was
written.

**It is configured in Resend as send-only.** No MX record, no inbound route, no mailbox. That is a
deliberate narrowing and it cost a product decision: DD14 required a monitored `Reply-To` on every
notification, and a header naming an address that receives nothing is a dead end asserted rather than
merely present. The spec carries the amendment; `@repo/notifications` sends no `Reply-To` and the
email frame invites no reply. **The day a mailbox exists, all three come back** — the variable, the
header, and the footer line — and that is a spec amendment in the other direction, not a config
change somebody makes quietly.

- [x] Sending subdomain added in Resend, DNS records published — `mail.recomencemos.online`
- [x] **SPF and DKIM resolve** — verified 2026-08-27 with `dig`, not assumed. Both answer:

```sh
dig @1.1.1.1 +short TXT send.mail.recomencemos.online
# "v=spf1 include:_spf.forge.rmta.net ~all"
dig @1.1.1.1 +short TXT resend._domainkey.mail.recomencemos.online
# "p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDttG/1du2yT25l…"
```

> **Query a public resolver explicitly.** The same two lookups returned **empty** through the
> operator's default resolver on the day they were checked, which reads exactly like an unpublished
> record. `@1.1.1.1` is the difference between "not published" and "my resolver has not caught up",
> and this check is worthless if it cannot tell those apart.

- [ ] **DMARC — not published, and this is the open one.** `_dmarc.recomencemos.online` has no `TXT`
      record (same date, same resolver). Resend does not require it, which is why it can be missed:
      SPF and DKIM verify green in the dashboard with this absent. Publish at the **root**, not the
      sending subdomain — a `_dmarc` record on `mail.` is not consulted for `recomencemos.online`:

```
_dmarc.recomencemos.online   TXT   "v=DMARC1; p=none; rua=mailto:<an address you read>; fo=1"
```

      `p=none` first, so reports arrive before anything is enforced; tighten to `quarantine` once the
      reports show only Resend signing. Tracked as an issue rather than living only in this checkbox.

```sh
dig @1.1.1.1 +short TXT _dmarc.recomencemos.online   # ticks this box when it answers
```

- [ ] **A receiving mailbox, or the decision not to have one, recorded.** The root domain carries
      Namecheap forwarding MX (`eforward1–5.registrar-servers.com`) — but those are added at
      registration and deliver nothing without a forwarding rule, and no rule exists. So a reply to a
      notification is rejected at the forwarder. **This box is what reopens DD14's amendment**: one
      forwarding rule to a real inbox makes the monitored `Reply-To` true again, and the variable,
      the header and the footer line all come back together.
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
- [ ] **The response-header set is shipped, and the CSP is enforced rather than report-only** (C6).
      The app sends all seven from `apps/web/lib/response-headers.ts`; there is nothing to configure
      at a proxy or a CDN, and adding one there would be a second place the set is described.
      Confirm it on the deployed origin rather than trusting the build:

```sh
curl -sSI https://<production-origin>/ | grep -iE 'content-security-policy|strict-transport|x-frame|x-content-type|referrer-policy|permissions-policy'
```

      The CSP must match `csp-policy` in [`../policy/security.md`](../policy/security.md) with the
      three placeholders resolved to the configured origins. `upgrade-insecure-requests` is the one
      directive that can legitimately be absent — the app withholds it wherever the policy admits a
      plaintext origin, so its absence here means one of the three is `http://` and that is the
      thing to fix:

```
default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self' https://accounts.google.com; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: <PHOTO_PUBLIC_BASE origin> <PHOTO_S3_ENDPOINT origin>; connect-src 'self' <sentry ingest origin> <PHOTO_S3_ENDPOINT origin>; font-src 'self'; upgrade-insecure-requests
```

      `frame-ancestors 'none'` is the load-bearing directive — without it `acceptOffer` is
      clickjackable, and that is one click releasing a displaced person's name, phone and email.

- [ ] **`PHOTO_S3_ENDPOINT` and `PHOTO_PUBLIC_BASE` are set at _build_ time**, not only at runtime.
      Next bakes `headers()` into the build, so a deploy that has them only as runtime secrets ships
      a CSP that names neither — and the first symptom is a photo upload that fails in the browser
      with the server logging nothing. The chain is already wired — `build.env` in `turbo.json`, an
      `ARG` in the `Dockerfile`, a `--build-arg` in `scripts/deploy.sh` — so what is left is the
      value itself: set **`PHOTO_S3_ENDPOINT`** and **`PHOTO_PUBLIC_BASE`** as GitHub repository
      **variables** (Settings → Secrets and variables → Actions → Variables), which is what
      `deploy.yml` reads. They are non-secret origins, so unlike the credentials in §1 they belong
      in `vars` rather than `secrets` and may appear in a build log. `pnpm exec turbo build --dry`
      prints the resolved task definition, and the deploy script warns on stderr when either is
      unset.

- [ ] **HSTS `preload` — decided, not defaulted.** The app sends
      `max-age=63072000; includeSubDomains` and deliberately **no** `preload`. Submitting the domain
      to the browsers' compiled-in preload list is close to irreversible: removal takes months and
      reaches a user only when their browser updates. Tick this box by recording the decision either
      way; adding `preload` means editing `hsts` in [`../policy/security.md`](../policy/security.md)
      first, and then submitting at <https://hstspreload.org>.
      **`includeSubDomains` reaches subdomains of the host that sent it and nothing else.** If the
      app ends up on `www.recomencemos.online` while the photo zone is a **sibling** rather than a
      child, the app's HSTS does not cover the photo host — check that host separately, on its own
      response.

- [ ] **`'unsafe-inline'` in `script-src` is known, recorded and open.** It is what keeps this app's
      prerendered shells, because a nonce is incompatible with Partial Prerendering. Scan the
      deployed origin at <https://securityheaders.com>, post the grade to the issue tracking the
      nonce trade, and do not treat the reading as a blocker on the announcement — it is the input
      that decides whether the trade is taken at all.
- [ ] **Uptime monitor**: probe `GET /api/health` every **60 s**, alert after **2 consecutive
      failures** (C33). With `on-call-rotation` at nobody, detection latency is the entire mitigation.
- [ ] **Daily digest at 08:00 America/Bogotá** wired through the notification seam, carrying NFR7's
      queue depths and the age of the oldest item (C10)
- [ ] **Machine bands open a `needs-triage` issue from CI** ([ADR-0001](../adr/0001-findings-enter-through-triage.md))

---

## 5a. The Google OAuth client (DD5, #12)

**Nobody owned this step, and the announcement gate depends on it.** §1 row 6 says how to _rotate_
the Google client secret; nothing said how the client comes to exist. Without it
`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are unset, and the sign-in surface renders the email
door alone — correctly and deliberately, but with the one-tap door missing on the device most
Workers hold.

- [ ] **Create an OAuth 2.0 Client ID** — Google Cloud console → APIs & Services → Credentials →
      Create credentials → OAuth client ID → **Web application**.
- [ ] **Configure the consent screen** as **External**, published. The app name a Worker reads on
      Google's own screen is `Recomencemos`; the support email is the operator's.
- [ ] **Authorised redirect URIs**, both, exactly: - `https://<production-origin>/api/auth/callback/google` - `http://localhost:3000/api/auth/callback/google`
      The second is not a convenience: Google permits `http://localhost` here precisely so the local
      flow is the _same_ flow, and without it the Google door cannot be exercised before a deploy.
      A mismatch is Google's `redirect_uri_mismatch`, which surfaces on Google's page rather than
      ours, so it will not appear in our logs.
- [ ] **Scopes: the three defaults only** — `openid`, `email`, `profile`. This design wants an
      identity assertion and nothing else, and it stores no provider token (DD5), so any additional
      scope is a permission we asked for and cannot justify on a consent screen a Worker reads.
- [ ] **`fly secrets set GOOGLE_CLIENT_ID=… GOOGLE_CLIENT_SECRET=…`**. Neither appears in any turbo
      task (NFR24) and neither belongs in `apps/web/.env.example`.
- [ ] **Verify the round trip on the deployed origin before the announcement**: sign in with Google,
      then confirm the session row carries `sign_in_method = 'google'`. That column is NFR14's
      mechanism, and a door that mints a session without setting it is the hole NFR14 exists to close.

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

A small number of Admins moderate everything — at least two, so that one losing a phone is an
inconvenience rather than an outage. Losing every second factor at once stops every Offer behind
NFR7's 24-hour band and leaves every reported Hirer frozen, because `unfreezeHirer` is an Admin
action. Enrol the second Admin at the same time as the first: the recovery path that needs no printed
code is another Admin who can still sign in.

**Rewritten 2026-08-30 with #96: the Admin door has no password.** This section used to grant an
Account with a 16-character password and then send a person to `/admin/sign-in` to enrol a second
factor. Both halves are gone — the password, and the route. The two factors are now a **single-use
emailed link** and a **TOTP code**, and the argument is in the spec at DD5, _The Admin door is
passwordless_.

**Enrolment is one command, and it grants last.** `pnpm admin:enrol` is not an endpoint and cannot
become one: `isAdmin` is declared `input: false`, so no request body sets the grant on any route. It
runs from a shell, over the **direct** connection, by whoever already holds the migration credential.

```sh
pnpm admin:enrol <email>
```

It prints a **one-time setup link** and then waits. Open the link in a browser; the page shows the
TOTP QR and the ten backup codes, **once**. Scan the QR, then type the six digits **back into the
terminal**. The command verifies them against the stored secret and only then sets the grant.

**The ordering is the safety property, not a convenience.** The grant is the last step, so an Account
cannot hold Admin authority until a working authenticator has proved itself — a link opened and
abandoned leaves no Admin behind, and there is no window in which a granted Account has no second
factor. Under the design this replaces, that window was the whole of the first sign-in.

- [ ] **First Admin enrolled end to end** with the command above — link opened, QR scanned, code
      accepted in the terminal, grant confirmed
- [ ] **Ten backup codes stored where one unlock cannot reach both factors.** The enrolment screen
      offers a **clipboard button and nothing else** (shape decision, `.impeccable/briefs/admin-enrolment.md`),
      so the ordinary destination is a password manager rather than paper. That is fine on one
      condition, and the condition is the whole of C43's rule restated for this mechanism: **the codes
      must not live in the same vault as the mailbox credential.** The mailbox is the other factor —
      one master password holding both is one factor wearing two coats. A separate vault, a separate
      device, or paper all satisfy it; the same vault does not.
      They are encrypted at rest with `BETTER_AUTH_SECRET` and nothing in this repository decrypts
      them, so leaving that screen without copying them loses them
- [ ] **A second Admin account on a separate device**, its own TOTP secret, same person — run the
      command again with the second address. This is the path that recovers the platform in minutes
      rather than hours
- [ ] **The second address is not in the same mailbox as the first** (C43). The first factor is now a
      link, so an Admin whose mailbox is unreachable — a provider outage, a locked account, a deleted
      address — cannot sign in at all. Two Admin addresses in one mailbox is one failure, not two.
      This is about the **mailbox**, not about deliverability: C58 records that Resend's sending from a
      cold domain was assessed and accepted
- [ ] **Break-glass rehearsed once** against a scratch database, so the first time it is run is not
      during the incident. It is the same command; see below
- [ ] **TOTP on every sign-in, and there is no trusted-device setting to check** (C44). This used to
      be a `trustDevice` field to strip from a request body. Better Auth's `twoFactor` plugin is not
      used at all now, so there is nothing to disable and nothing to assert about it — the door has no
      path through it that skips the code

**Break-glass is re-enrolment**, over the direct connection (#2 in §1):

```sh
pnpm admin:enrol <admin-address>    # the same command; issues a fresh secret and fresh codes
```

**There is no "disable the second factor" statement any more, and that is deliberate.** The old
break-glass was `UPDATE "user" SET two_factor_enabled = false`, which left a door open on a password
alone. With no password, disabling the second factor would leave an account with **no** door rather
than a weaker one, so the only useful recovery is to enrol a new authenticator — which is what the
command does. Rehearse it against a scratch database anyway: what is being rehearsed is that the
person holding the migration credential can reach a shell and run it under pressure.

---

## 7. Legal — Ley 1581, and the operator is personally the _responsable_ (C15)

[Intent Q4](../efforts/0002-profile-to-contact-exchange/intent.md) records that the repo owner
personally is the _responsable del tratamiento_, accepted knowingly. DD8 verified that **RNBD
registration does not apply** to a _persona natural_. International transmission is the part that does.

- [ ] **`RESPONSIBLE_PARTY_NAME` and `RESPONSIBLE_PARTY_EMAIL` set through `fly secrets`.** The
      _aviso de privacidad_ names the _responsable_ and the mailbox a _consulta_ or a _reclamo_
      reaches, and both are deployment configuration rather than committed copy — a legal identity
      does not belong in a public repository. `responsibleParty()` **refuses the development
      placeholders under `NODE_ENV=production`**, so `/privacy` fails loudly rather than going live
      naming nobody. Verify by loading `/privacy` on the deploy and reading the first section
- [ ] **A mailbox that actually answers.** The address above is the one Ley 1581 obliges a reply on,
      so it has to be one a person reads — the sending subdomain in §4 publishes no MX record and
      receives nothing, so it cannot be this
- [ ] **_Aviso de privacidad_ names every processor** with its country and purpose: PlanetScale, Fly,
      Cloudflare, Google, Resend, Sentry. The page is at `/privacy` and `PROCESSORS` in
      `apps/web/app/_lib/consent/processors.ts` is the list
      ([#14](https://github.com/m0t0r/recomencemos/issues/14)); adding a vendor is a change there
      plus a version bump in `CONSENT_NOTICE_VERSIONS`. **The box is what a human checks after
      reading the deployed page**, because the list being in the source is not the same claim as the
      disclosure being complete and current on the day of the announcement
- [ ] **_Autorización_ carries express consent to international transmission**, shown at publish and
      at first Offer send, versioned in the Consent row. The text, the control and the row ship with
      #14 — but **no surface renders the control yet**: `/publish`
      ([#16](https://github.com/m0t0r/recomencemos/issues/16)) and the Offer form
      ([#24](https://github.com/m0t0r/recomencemos/issues/24)) are what put it in front of a person
      and write the row. This box cannot be checked until both have landed
- [ ] **Each vendor's DPA / SCCs downloaded and filed** — deferred from Design at C15, and named there
      as the half a regulator asks for first
- [ ] Whether SIC's **Circular Externa 005 de 2017** lists these countries as adequate: checked, and
      the answer recorded. The design does not depend on it — express authorization is taken either
      way — but the answer changes what the filing above must produce
- [ ] The habeas data clock is a **business-day** calendar: Colombia has ~18 public holidays and
      `America/Bogota` is UTC−5. A _consulta_ is 10 business days (+5), a _reclamo_ 15 (+8)

---

## 8. Repository and release (C7, C16)

- [ ] **Required status checks** on the default branch, by the job names
      `.github/workflows/ci.yml` publishes: **`lint`**, **`format`**, **`check-types`**, **`test`**
      (which is `turbo run test test:gates`, so `test:gates` is inside this one), **`build`**, and
      **`audit`**. The workflow is one job per check rather than one job of steps precisely so each is requirable by
      name. **No required reviews** — on a one-person repository they lock the operator out or
      normalize admin bypass
- [ ] `format` is **`oxfmt --check`** — it reports and never rewrites, so requiring it cannot push to
      a contributor's branch. It was added on 2026-08-28 after formatting drift on three `docs/`
      files put 54 lines of unrelated churn into three separate pull requests; the reasoning is in
      [`../policy/build.md`](../policy/build.md) → "Why `format` is a required check"
- [ ] Dependency audit fails the build on **`high` or above in a direct dependency** (C7). This is
      the `audit` job, running `pnpm audit:direct` — `scripts/audit-direct.mjs`, not
      `pnpm audit --audit-level=high`, which is red on arrival against a transitive advisory this
      repository already carries
- [x] **Dependabot on** — three switches, not one: on a private repository the dependency graph is
      not enabled by default, and alerts and security updates each depend on the one before it. The
      commands are below this list. Version updates need no switch: they are the committed
      `.github/dependabot.yml`, and security-update PRs are exempt from its
      `open-pull-requests-limit`, which is the point of them
- [ ] `gh extension install github/gh-stack` — `stacked-prs` is on for genuine chains, and
      `pr-merge-method` is **rebase**, because squashing a lower PR rewrites the base every branch
      above it was cut from
- [ ] **Rollback rehearsed once against production**: bluegreen, health-gated, ≤ 5 minutes by one
      documented command (NFR25)

The three Dependabot switches, and how to read that they took:

```sh
gh api -X PUT repos/<owner>/<repo>/vulnerability-alerts      # 204 No Content
gh api -X PUT repos/<owner>/<repo>/automated-security-fixes  # 204 No Content
gh api repos/<owner>/<repo>/automated-security-fixes         # {"enabled":true,"paused":false}
```

`vulnerability-alerts` answers `404` while alerts are off and `204` once they are on, so the same
`GET` is both the check and the evidence.

---

## 9. Security review before the announcement (C8)

`pentest-cadence` is **none external**, recorded as a decision rather than a silence. What runs in its
place:

- [x] The **Security review** pass in `REVIEW.md`, run by the `security-auditor` subagent on every PR
      touching **auth, the exchange path, or an egress**. The path condition is deliberate — a
      security review on the PR that changes a font size teaches the reader to skim. The path list
      is in `docs/agents/security-audit.md` → "Reviewing one pull request"
- [ ] **One full `/security-audit` run** against the built system before the announcement, configured
      as `docs/agents/security-audit.md` → "Running a full audit" says, with DD16's boundary table
      handed to it as input so its first phase does not have to infer an architecture
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
- [ ] **The Admin enrolment path is bounded in the drain.** `secrets-in-url-paths` in
      [`../policy/security.md`](../policy/security.md) is `yes` for `GET /admin/enrol/[token]`, and
      `context.path` on the request-completion line carries that token verbatim. Confirm the drain
      either drops or redacts that path before the announcement, and record which
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
