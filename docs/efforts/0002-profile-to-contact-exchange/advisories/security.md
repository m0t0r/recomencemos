# Security advisory — 0002 profile-to-contact-exchange

Read against `docs/policy/security.md` (`threat-model-scope` = anyone on the internet;
`compliance-regime` = Ley 1581 de 2012; `mfa-requirement` = Admin only), ADR-0008 (nobody is
verified), ADR-0009 (gated identity, load-bearing `noindex`), and the code the spec touches:
`packages/errors/src/redaction.ts`, `packages/observability/src/log-request-complete.ts`,
`apps/web/sentry.server.config.ts`, `apps/web/instrumentation-client.ts`.

The draft is unusually strong on the disclosure axis — three whitelisted projections, NFR10's
sentinel count, NFR9's cache bound, NFR8's route-list `noindex` test. Where it is thin is the other
five STRIDE letters and, specifically, the direction the intent warned about: **almost every
protective mechanism in the draft points at the bad Hirer.** The adversary who arrives as a Worker
is named in the intent and modelled nowhere in the design.

---

## Recommend

### The boundaries, walked

- **Name the trust boundaries explicitly and walk STRIDE per boundary.** The draft marks `[trust]`,
  `[network]` and `[cache]` in the high-level design, which is the right instinct, but no boundary
  has a threat walk attached. The seven this change crosses: the anonymous browser → public routes;
  the authenticated browser → Server Actions; the Admin browser → `/admin/*`; the Resend webhook →
  `POST /api/webhooks/resend`; the app → object storage; the app → Resend; the app → Sentry. The
  last three are outbound and are where personal data leaves the system, which is why they are not
  optional rows.

- **Write the abuse cases beside the `Must` stories, and write the Worker-side ones first.** They
  are what makes the asymmetry legible. The set that has no mitigation in the draft as written:
  *As an attacker I publish many CapabilityProfiles from many throwaway addresses, so that the
  browse order — which favours the fewest delivered Offers — puts my profiles at the top.*
  *As an attacker I create an Account and read every gated profile, so that I harvest the
  self-descriptions and work histories of every displaced person on the site.*
  *As an attacker I accept an Offer, so that a real person's name, phone and email are delivered to
  me for the cost of one email address.*
  *As an attacker I Report every Offer I receive, so that legitimate Hirers are frozen without a
  human in the loop.*
  *As an attacker I send hundreds of Offers, so that the 24-hour review queue held by one unpaid
  person becomes unholdable and NFR7 fails for everyone.*

### The one-way harvest is the central unmitigated risk

- **Settle a per-Account and per-IP ceiling on gated profile reads, and make it an NFR with a
  number.** ADR-0009 says in its own text: *"the same open surface that lets anyone publish lets
  anyone harvest."* The draft's answer to harvesting is "reading a full profile costs him an
  Account", and under `auth-provider` = Better Auth magic link an Account costs one disposable email
  address and one round trip. `PublicProfile` carries `slug`, so `/perfiles` hands an enumerator the
  complete key set for `/perfil/[slug]`; there is nothing left to guess. A ceiling (a defensible
  starting point: ~60 gated profile reads per Account per hour, ~300 per day, and a per-IP bound
  above it) turns a full-corpus scrape from a twenty-minute script into something that takes weeks
  and shows up as a signal. It also gives the Admin queue a sixth item worth having.

- **Settle rate limits on every state-changing Server Action, not only on `requestMagicLink`.** The
  contract rate-limits exactly one surface. `publishProfile`, `uploadPhoto`, `sendOffer`,
  `reportOffer`, `requestSkill` and `changeEmail` are all unbounded as specified, and each has a
  distinct cost: `publishProfile` and `requestSkill` flood the Wall and the queue, `uploadPhoto`
  floods storage, `sendOffer` and `reportOffer` flood the one human. **The scarcest resource in this
  whole design is the reviewer's attention, and nothing in the draft protects it.** NFR7 promises
  ≤ 24 h for the oldest undelivered Offer with no mechanism standing between that promise and a
  single attacker with a loop.

- **State where the rate-limit counter lives, and that it fails closed.** On one Fly machine an
  in-process counter is honest and cheap; a Postgres-backed one survives the deploys that Q8 makes
  frequent. Either is defensible. What is not defensible is leaving it unstated, because the default
  a Build session reaches for is an in-memory map that resets on every deploy — and Q8 says deploys
  are continuous. Also state the behaviour when the limiter's store is unreachable: deny, not allow.

### The Sybil hole in the attention-spread mechanism

- **NFR21's ordering rewards exactly what an attacker can manufacture for free.** "Fewest delivered
  Offers ascending" means a profile with zero delivered Offers sorts first, and every fake profile
  has zero. The bound NFR21 states — no profile receives more than `⌈3 × M/N⌉` delivered Offers —
  measures concentration among real profiles and says nothing about `N` being inflated by an
  adversary. The mechanism designed to spread attention to displaced people is the mechanism that
  hands a flooder the top of the list. Settle at minimum: a publish rate limit per IP and per
  address, one CapabilityProfile per Account (already implied by the 1:1, so say it is enforced by a
  unique constraint and not by the form), and an Admin queue signal when publish volume exceeds a
  stated per-hour figure. NFR1's ≤ 5 s forbids human review on the publish path, so the control has
  to be a rate and a signal rather than a gate.

### Authorization lives in the domain module's signature, not in its prose

- **Make the principal a required first parameter of every `@repo/domain` function that reads or
  writes an owned row, and export no unscoped finder.** The draft says "every read of one scopes by
  whichever the caller is" and "there is no entity in this model without an owner, which is the
  property that makes an IDOR a compile-time shape question." The ownership edges are right; the
  compile-time claim is not yet earned, because nothing in the stated shape stops
  `offers.findById(id)` from existing and being called from an Admin surface today and a Worker
  surface tomorrow. `getOffer(actor: Principal, offerId)` with no sibling overload is what turns the
  prose into a type error. This is the spec's own DAL rule (`docs/policy/security.md`: authorize at
  the resource) made mechanical.

- **Rename `requireHirer`.** An Account is not typed at sign-up — it becomes a Hirer by having sent
  an Offer — so there is no Hirer-ness to require and the guard is `requireAccount`. A guard whose
  name implies a role check it does not perform is the shape a future reader trusts by mistake. The
  real check is a separate, DB-read assertion on `offerSendingState`, and it must be read from the
  row on every `sendOffer` rather than from anything carried in the session.

- **Say that `requireAdmin` verifies the session's authentication method, not the principal's
  enrolled factors.** NFR14 as written — *"every `/admin/*` response to a principal lacking both a
  password factor and a verified TOTP factor is a 403"* — is satisfied by an Admin who *has* both
  factors enrolled but signed in through the magic link that every Account can use. That makes TOTP
  bypassable by whoever holds the Admin's inbox, which is precisely the threat MFA was added for.
  Either the Admin Account's magic-link path is disabled outright, or the check is on the session's
  recorded authentication level. Both halves belong in the NFR.

### The cache is a privilege boundary, and the draft leans on the wrong guarantee

- **Do not rest NFR9 on the framework.** The draft says *"a gated read cannot compile inside a
  cached scope because it reads `cookies()`."* What the framework forbids is calling `cookies()`
  inside `use cache` — it says nothing about which *data* the cached function returns. The leak this
  design will actually produce is the compliant-looking one: authorize outside the cache, pass the
  profile id in as an argument, and return `GatedProfile` from a shared entry. That compiles, and it
  serves one Worker's `about` and work history to everyone who hits the entry. The real mechanism is
  NFR9's second half — the test that renders every cached function and asserts its output against
  the public whitelist — and the spec should say the test is the mechanism and the framework is a
  coincidence.

- **State which surfaces a Block reaches, because the Wall cannot be one of them.** `CONTEXT.md`
  binds Block as *"her CapabilityProfile becomes invisible to him"*. `/` and `/perfiles` read
  through a shared cached function that cannot read `cookies()`, so her card is on the Wall for a
  Blocked Hirer exactly as it is for everyone else. The design can deliver invisibility at
  `/perfil/[slug]` and refusal at `sendOffer`, and it cannot deliver it on the public list without
  giving up the cache. Say so, in the product copy as well as the spec — a Worker told she is
  invisible to him when she is not is being sold a protection that does not exist, which is the one
  thing ADR-0008's whole framing exists to refuse.

- **Every moderation and deletion action revalidates the Wall's cache tag, in the same transaction's
  aftermath.** `takeDownProfile`, `rejectPhoto`, `deleteAccount` and a Block all change what the
  public list may contain. NFR6 says "0 unmoderated photos reachable at any time"; a stale cache
  entry is the exact mechanism that breaks it, and with `remote-cache-handler: none` the only thing
  standing between a takedown and a public page is an explicit `revalidateTag`.

### Two `noindex` mechanisms that interfere

- **NFR8 requires both a `noindex` response and a `robots.txt` disallow on `/perfil/*`, and they
  work against each other.** A crawler obeying `Disallow` never fetches the page, therefore never
  sees the `noindex`, and a URL that is disallowed but linked can still be indexed as a bare URL.
  If the slug is derived from her name, ADR-0009's harm — a permanent search result under her name
  — arrives through the URL string alone. Settle two things: **the slug is opaque and carries no
  part of her name**, and either drop `/perfil/*` from `robots.txt` so the `noindex` is actually
  read, or accept URL-only indexing knowingly. Given ADR-0009 calls the `noindex` "load-bearing and
  easy to lose", this is the place it gets lost.

### The magic link is the whole key, and three things about it are unstated

- **State the link's TTL, that it is single-use, and what happens when a mail scanner consumes it.**
  Email is the only credential in this system. A `GET` verify URL is fetched by corporate link
  scanners, WhatsApp previews and Outlook Safe Links, and a single-use token consumed by a scanner
  locks a Worker out with no password to fall back on — which is a security control producing an
  availability failure on the fragile side of the market. Verify the pinned `better-auth@1.7.1`
  behaviour rather than the plugin's documented defaults, and state the chosen numbers.

- **`changeEmail` as specified is a full account takeover primitive.** `{ email } → { ok }` with no
  stated verification means whoever holds a session — including the one left behind on the
  cybercafé machine story 12 exists because of — repoints the account to their own address and owns
  it permanently. Settle: the new address is verified before the switch takes effect, the old
  address is notified, and all other sessions are ended on completion. Story 20 (bounce recovery)
  needs this path to work from a held session, which is exactly why it needs the confirmation step.

- **Constrain the return path.** Story 5 redirects an anonymous caller to `/entrar` "with a return
  path". An unvalidated `next` parameter that reaches a redirect is an open redirect, and one that
  reaches Better Auth's `callbackURL` is an open redirect on the end of an authentication flow.
  Require a single-leading-slash relative path, reject `//host` and `/\host`, and set
  `trustedOrigins` explicitly rather than inheriting a guess from the Fly hostname.

### Fail closed, stated per decision point

The draft states behaviour for the `false` answer at every check and for the error answer at none.
The four that matter:

- `sendOffer` when the Block-edge read or the `offerSendingState` read throws → refuse.
- The Wall render when `photoState` cannot be read → render the initial, never the photo. NFR6's
  "0 at any time" is otherwise satisfiable only on the happy path.
- `acceptOffer` when the notification send fails → the ContactExchange still commits and the
  on-site copy is the durable channel (story 9 already says the email must not be the only copy;
  make the transaction ordering that promise's mechanism: commit, then enqueue).
- The rate limiter when its store is unreachable → deny.

### Least privilege on the Admin, who holds everything

- **NFR11 and the Admin contradict each other, and the spec should say which wins.** NFR11: contact
  details appear in *"0 responses to any principal"* before acceptance. The Admin queue's fifth item
  is bounced **email addresses**, which are `personal` contact details, shown to a principal before
  any acceptance. As written NFR11 is either false or the bounce queue is out of compliance with it.
  Settle the exception explicitly and bound it: the Offer-review item needs the Offer body and the
  Worker's display identity and **not** her phone; the bounce item needs the address; the Report
  item needs neither. Per-queue-item field lists are the least-privilege version of "the only role
  that reads contact data in bulk".

- **Add an admin audit record to the core entities.** Repudiation is the one STRIDE letter with no
  entity behind it. `takeDownProfile`, `rejectOffer`, `resolveReport`, `unfreezeHirer` and any Admin
  read of a ContactExchange are consequential acts by a single unsupervised principal who is also
  the person the platform's users have no recourse against. Actor, action, target id, timestamp —
  ids and enum values only, no personal payload. It must be a table and not log lines, because
  NFR18 forbids the payload from reaching a line and NFR17 gives logs a 30-day life.

- **Split the database credential.** The app needs DML; migrations need DDL. One PlanetScale role
  doing both means an application-layer SQL flaw reaches `DROP`. `@repo/db` already exposes
  `./migrate` as a separate subpath, so the seam exists; the credential should follow it.

- **Say how the first Admin grant is made.** `isAdmin` is a boolean on Account and nothing in the
  contract sets it. If the answer is a manual `UPDATE` against production, say that — it is a
  defensible answer for a one-person platform, and an undocumented one becomes a self-grant endpoint
  the first time someone needs it at 2 a.m.

### Uploads

- **Object storage keys are server-generated and opaque; the client's filename never reaches the
  key.** Otherwise `uploadPhoto` is a path-traversal and cross-Worker-overwrite primitive.

- **NFR6 is stated over *surfaces*, and the object is not a surface.** "0 unmoderated photos
  reachable from any public or indexable surface" is satisfied by a pending photo sitting at a
  publicly-readable storage URL that no page links to. Restate the bound over the object: pending
  and rejected photos are not readable without a short-lived signed URL, or they are served through
  an authorizing route. And **a rejected photo's object is deleted, not merely flagged** — a
  rejected image that lives at a URL forever is the outcome NFR6 exists to prevent, arriving late.

- **Strip image metadata on ingest by re-encoding, and say so as a requirement.** A photo taken on a
  phone carries EXIF GPS. Publishing that on an indexable Wall gives the precise location of a
  displaced woman to anyone who downloads the file. Re-encoding also closes the SVG-and-polyglot
  route to stored XSS in one move, so state the accepted input types as a raster allowlist enforced
  by decode rather than by `Content-Type`, plus a byte ceiling and a pixel-dimension ceiling — the
  decompression bomb is the shape that kills a single Fly machine.

- **Serve user images with `X-Content-Type-Options: nosniff` from an origin that is not the app's,
  or with a `Content-Security-Policy` that makes the app origin unable to execute them.**

### Response headers, and the one-click action they protect

- **`frame-ancestors 'none'` is not cosmetic here.** `acceptOffer` is a single click that releases a
  displaced person's full name, phone and email to a stranger. That is the highest-value one-click
  state change in the system and the obvious clickjacking target. Ship `frame-ancestors 'none'` plus
  `X-Frame-Options: DENY`, and make acceptance a two-step confirmation that names, in her language,
  exactly which of her details are about to cross and that it cannot be undone.

- **Settle the header set as a group**: CSP, HSTS, `X-Content-Type-Options`,
  `Referrer-Policy: strict-origin-when-cross-origin` (a gated page's URL should not travel to any
  external site a user clicks through to). `csp-policy` is `UNSET` — see C-S2.

### Injection surfaces the draft does not name

- **State that no user-supplied text is ever rendered as HTML or Markdown, anywhere.** React escapes
  by construction, so the rule costs nothing today and is worth writing down precisely because it
  costs nothing until someone adds a rich-text field.

- **The email templates are the exception, and they are unescaped by default.** `@repo/notifications
  /templates/*` interpolates an Offer body, a headline and a display name into HTML that lands in
  someone's inbox. That is the one rendering path in this design where React's escaping does not
  apply, and it reaches both sides of an unverified market. Require explicit escaping at the
  template seam and no raw `<a href>` built from user text.

- **NFR12/DD3's rejector should cover URLs, or the spec should say why it does not.** The list is
  "a phone number or an email address". `wa.me/573001234567` is a phone number wearing a URL, and
  `t.me/…` and a shortened link are the routes around the consent step that a phone-number regex
  does not see. NFR12 is honest that it is a speed bump and that human review is the control — keep
  that honesty and extend the bump, since a URL in an Offer body is also the phishing vector against
  the Hirer side.

### Ley 1581 obligations the draft has not yet reached

- **The Hirer consents to nothing.** Story 14 and the `Consent` entity cover the Worker at publish
  time. The platform also collects, stores and *discloses to a third party* the Hirer's name, phone
  and email at Contact Exchange, and there is no privacy notice, no *autorización*, and no Consent
  row on that side. Under Ley 1581 the Hirer is a *titular* too. The cheapest correct shape is a
  Consent row written on first Offer send.

- **Every processor here is outside Colombia.** PlanetScale, Fly, Resend and Sentry are
  international *transmisiones* of `personal` data. That needs the *autorización* to say so and a
  transmission contract or equivalent with each. Also verify the **RNBD** registration threshold
  against current SIC guidance — the intent's Q4 already asked for this and the draft has not
  answered it.

- **NFR17's purge does not reach backups.** A 12-month purge with an unstated backup retention
  horizon is not a *supresión*; it is a delay. `backup-rpo` / `backup-rto` and `soft-delete` are
  `UNSET` in `docs/policy/data.md`, and if `soft-delete` lands as "tombstone" then story 13's
  deletion promise is false as stated. See C-S6.

---

## Risks

- **`fullName` exists on the wire and nowhere else.** `ExchangedContact` publishes `fullName`, the
  `ContactExchange` entity snapshots "the Worker's full name", ADR-0009 says full name is released
  at Contact Exchange — and `CapabilityProfile` deliberately has no such column while story 2
  collects only `firstName` and `lastInitial`. As drafted the exchange promises a field the system
  never collects. Whichever way it resolves has a security consequence that should be decided rather
  than discovered at Build: collecting it at publish time means a database of displaced people's
  full names exists from day one under a 12-month retention; collecting it at acceptance means a new
  input on the highest-stakes action in the product. The draft's own C1 gestures at this; the
  gesture needs to become the decision.

- **The exchange is asymmetric in identity, and the asymmetry runs against the vulnerable side.**
  `ExchangedContact` claims "the counterpart's same three" for the Hirer — name, phone, email — and
  no story, entity or route ever collects a Hirer's name or phone. Magic link proves he controls an
  inbox. So as written she hands a verified-reachable phone number to a party identified by a
  disposable address, and receives either nothing or three self-asserted strings typed at exchange
  time with nothing checking them. That is the design modelling only the bad Hirer *and then*
  underprotecting against him. It also caps what any Report can ever accomplish: with no durable
  Hirer identity, a banned Hirer re-registers in thirty seconds and `offerSendingState` is a
  speed bump on an account, not on a person. Say that out loud where the ban is described.

- **The Report freeze is a Worker-side weapon and the draft treats it only as a shield.** NFR15
  makes the freeze synchronous, reason-free and human-free, which is right for the Worker it exists
  to protect. It also means any Account holding a CapabilityProfile can freeze any Hirer who
  contacts her, unbounded, and under ADR-0008 nothing stops an adversary holding fifty such Accounts.
  With `on-call-rotation` = nobody and the unfreeze sitting in a 24-hour queue, a handful of
  bad-faith Reports removes the scarce side of the market for a day. Keep the freeze — it is the
  right default — and add the counterweight the draft is missing: a Report rate per profile, and a
  queue signal when one profile reports many Hirers.

- **A freeze stops sending and nothing else.** A Hirer reported for an abusive Offer keeps full
  gated read access to every Worker's `about` and work history, and keeps any already-`delivered`
  Offer live and acceptable, until a human acts. The `reportOffer` transaction should at minimum
  suspend his gated reads of *her* profile and mark his undelivered Offers non-deliverable.

- **`blockHirer` takes `{ hirerAccountId }`, which means Hirer Account ids cross to the browser.**
  Anything a Server Component renders is published (`docs/policy/security.md`). Key the Block by
  `offerId` and resolve the Hirer server-side; then no internal identifier for a third party ever
  reaches a client payload, and the action cannot be called with an id its caller was never offered
  by. The same reasoning covers whether `pk-strategy` yields sequential integers —
  `docs/policy/data.md` → `pk-strategy` is `UNSET`, and a sequential Offer id is an enumeration
  handle and a row-count leak.

- **The magic-link token can reach Sentry, and the policy's reasoning for `secrets-in-url-paths` =
  `no` does not cover it.** The policy checked exactly one egress: `pathOf` in
  `packages/observability/src/log-request-complete.ts` strips query and hash before the completion
  line is written, so the token stays out of the log. But `packages/errors/src/redaction.ts` scrubs
  by **key name** over a fixed carrier list — `data`, `request.headers`, `request.cookies`,
  `contexts`, `extra`, `tags`, breadcrumb and span `data`, stack-frame vars — and `request.url` is
  not among them. The file says so in its own words: *"a secret in a URL rather than under a key —
  `request.url` holding `?api_key=…`. Matching by key name structurally cannot see it."* With
  `tracesSampleRate: 0.1` in production, roughly one in ten verify requests ships its full URL,
  token included, to Sentry — and any error on that route ships it at 100%. This is the single key
  to a Worker's account leaving the system to a third-party processor. Either strip query strings
  from `request.url` in the scrubber before this effort ships, or the `secrets-in-url-paths`
  answer is wrong in practice while being right on the page.

- **NFR18 bounds log lines and leaves the Sentry egress open for personal data too.** The redaction
  list contains `password`, `token`, `cookie`, `ssn` and their relatives. It contains no `phone`,
  no `email`, no `about`, no `workDescription`. An `AppError` thrown out of `sendOffer` or
  `acceptOffer` with `context: { profileId, phone }` reaches `beforeSend`, passes the scrubber
  untouched, and lands in Sentry. `CLAUDE.md` already names this as the rule redaction cannot
  enforce; this effort is the first one whose data is *mostly* the thing the list cannot see. NFR18
  should be restated over "every egress that leaves the machine" — log line, Sentry event,
  transaction, breadcrumb — and the test should drive the Sentry hooks with the same sentinels, not
  only the logger.

- **NFR23 pushes runtime credentials toward the build environment.** "Every credential goes in
  `passThroughEnv` on the one task that needs it" is right for `SENTRY_AUTH_TOKEN`, which a build
  genuinely needs. `DATABASE_URL`, `RESEND_API_KEY`, the webhook signing secret, the storage
  credentials and Better Auth's secret are needed by **no** turbo task — they are read at runtime on
  Fly. As written the NFR invites someone to add a production database URL to a turbo task's
  environment, and `.env*` files are `build` inputs. Split the sentence: build-time credentials go
  in `passThroughEnv`; runtime credentials appear in no turbo task at all and live wherever
  `secret-store` says (C-S1).

- **A forged Resend webhook is an account-denial primitive.** The contract says "verified by
  signature", which is the right answer and half of it. A forged bounce sets `emailStatus` on any
  address the attacker names, and with magic link as the only sign-in that is a lockout delivered to
  a queue. State: which secret verifies it and where it comes from, a timestamp window so a captured
  event cannot be replayed, idempotency on the provider's event id, and that a failed verification
  is a bodyless 401 that is logged with the event id and nothing else.

- **`deleteAccount` is irreversible and takes no re-authentication.** On the shared-device path that
  story 12 exists for, an abandoned session destroys a Worker's profile. The confirmation string is
  a UI speed bump, not an authentication. Weigh a fresh magic-link confirmation against the cost of
  requiring an inbox from someone who may be on a borrowed phone — that trade is exactly the kind
  this project has been making well, and it should be made explicitly rather than defaulted.

- **The shared-device session needs both halves bounded server-side.** NFR13 says 8 hours and
  non-persistent. A non-persistent cookie dies when the browser closes, and a cybercafé browser may
  not close for a week. The server-side session row must expire at 8 hours independently of the
  cookie, and `signOutEverywhere` must delete rows rather than clear cookies. Also verify against
  `better-auth@1.7.1` whether a session cookie cache is enabled: if it is, every revocation in
  NFR13 and the "0 further requests" in NFR15 lag by the cache TTL, and both numbers become
  approximately-true. Read the same way, `offerSendingState` must never be cached in the session.

- **A Worker can send an Offer to her own profile.** Nothing in the contract refuses it; it inflates
  `deliveredOfferCount` — which is the input to NFR21's ordering — and costs the reviewer's
  attention. One line in the Offer state machine.

---

## Concerns

- [ ] **C-S1** — Where the six new credentials live and who rotates each: PlanetScale, Fly, Resend,
      the Resend webhook signing secret, object storage, Better Auth's session secret, plus the
      existing `SENTRY_AUTH_TOKEN`. This effort is the first thing this repository has ever
      deployed, so there is no incumbent answer.
      **Risk if wrong:** a production database URL for a table of displaced people's phone numbers
      ends up in a `.env` file, which is a Turborepo `build` input and one `git add` from an
      incident. **Owner:** Security owner.
      **Unblocks by setting:** `docs/policy/security.md` → `secret-store`

- [ ] **C-S2** — The Content-Security-Policy this app ships, or the recorded decision not to.
      The app serves user-uploaded images, loads the Sentry browser SDK, and its most valuable
      one-click action releases a person's contact details.
      **Risk if wrong:** no `frame-ancestors` means `acceptOffer` is clickjackable; no `img-src`
      bound means a stored-image escape has the whole origin.
      **Owner:** Security owner.
      **Unblocks by setting:** `docs/policy/security.md` → `csp-policy`

- [ ] **C-S3** — What blocks a release: a CVE severity threshold, a licence allowlist, or neither.
      This effort adds `better-auth`, `drizzle-orm`, `pg`, `resend` and a storage SDK to a
      repository that had almost no runtime dependency surface, onto continuous deployment with
      `on-call-rotation` = nobody.
      **Risk if wrong:** an advisory against the authentication library ships to production
      unnoticed, because nothing is watching and nothing blocks.
      **Owner:** Security owner.
      **Unblocks by setting:** `docs/policy/security.md` → `dependency-policy`

- [ ] **C-S4** — `session-lifetime` is still `UNSET` in policy while NFR13 proposes to settle it,
      and the revocation half depends on behaviour of the pinned `better-auth@1.7.1` that this
      advisory could not verify.
      **Risk if wrong:** the key stays `UNSET` and the next spec raises it again; or the numbers
      ship and revocation silently lags a session cookie cache, so "sign out everywhere" does not.
      **Owner:** Security owner.
      **Unblocks by setting:** `docs/policy/security.md` → `session-lifetime`

- [ ] **C-S5** — Whether the Admin is an explicit exception to NFR11's "0 responses to any
      principal", and which personal fields each of the five queue item types may render.
      **Risk if wrong:** NFR11 is untestable as written and the Admin surface accretes contact data
      it never needed, concentrating the whole database's `personal` columns behind one password.
      **Owner:** Security owner (with Data lead).

- [ ] **C-S6** — Whether a purge reaches backups, and whether deletion is a delete or a tombstone.
      NFR17 states 12-month purges; `backup-rpo`, `backup-rto` and `soft-delete` are all `UNSET`.
      **Risk if wrong:** story 13 tells a Worker deletion "removes everything from the platform"
      while the row survives in backups and tombstones — a false statement to a *titular* under
      Ley 1581, made on the deletion screen.
      **Owner:** Data lead (with Security owner).
      **Unblocks by setting:** `docs/policy/data.md` → `soft-delete`, `backup-rpo`, `backup-rto`

- [ ] **C-S7** — Authorization for international transmission of `personal` data to PlanetScale,
      Fly, Resend and Sentry, and whether the RNBD registration threshold is met.
      **Risk if wrong:** the *responsable* — a named individual holding personal liability, per
      intent Q4 — is transmitting personal data abroad without the authorization or the transmission
      contract Ley 1581 requires, and without the register it may require.
      **Owner:** Security owner (as *responsable del tratamiento*).

- [ ] **C-S8** — Whether an external party ever looks at this, given the data class and the
      threat-model scope. "Never" is a legitimate answer for an unfunded one-person platform and is
      worth recording as a decision rather than as an absence.
      **Risk if wrong:** the only review this system ever receives is its own.
      **Owner:** Security owner.
      **Unblocks by setting:** `docs/policy/security.md` → `pentest-cadence`

---

## Handoffs

- **Data lead** — `pk-strategy` decides whether Offer ids and Account ids are enumeration handles
  and row-count leaks; `soft-delete` decides whether story 13's promise is true; the backup horizon
  decides whether NFR17 is a retention policy or a delay. I have named the security consequence of
  each and cannot settle any of them.

- **Data lead** — the profile `slug`'s derivation is a schema decision with an ADR-0009 consequence:
  a name-derived slug puts her name in a URL that `robots.txt` may cause Google to index as a bare
  string. I recommend opaque; the key generation belongs on that edge.

- **On-call lead** — every rate limit and abuse signal I recommend is only protective if someone
  learns about the breach, and `alert-destination` is `UNSET` (intent Q3 says this effort should set
  it). A Sybil-publish signal that lands in a queue nobody opens for three days is not a control.
  The Admin queue's own age-of-oldest display (story 22, `Could`) is the closest thing to an alert
  this design has, which argues for promoting it.

- **On-call lead** — I could not assess whether migrations run at boot on the single Fly machine.
  If they do, the DDL credential is present in the running app's environment and the split I
  recommend above does not hold; that is an operability decision with a privilege consequence.

- **Simplicity advisor** — several of my recommendations add mechanism (rate limits, an audit table,
  a Hirer Consent row, image re-encoding). I believe each is load-bearing, and I expect at least the
  audit table and the Hirer Consent row to be argued against. The one I would defend hardest is the
  rate limits, because the resource they protect is a single unpaid human.

---

## Not applicable

- **Cross-tenant isolation.** There are no tenants; the ownership edges are per-Account and
  per-CapabilityProfile, and the draft models them correctly.

- **XSS through the app's own rendering.** React escapes by construction and nothing in this design
  needs `dangerouslySetInnerHTML`. I have recommended writing the rule down rather than raising it
  as a finding. The email templates are the real exception and are listed above, not here.

- **CSRF on Server Actions.** Next 16 performs an Origin/Host check on Action POSTs. Better Auth's
  own route handler needs `trustedOrigins` set, which I have listed above; the Actions themselves
  do not.

- **Payments, escrow, and financial fraud.** ADR-0007 removes the entire class. The corresponding
  residual — that a Hirer simply does not pay, with no recourse — is the seven-day check-in's job
  and a product decision already made, not a security gap.

- **Secrets in URL path segments.** Verified rather than assumed: Better Auth's magic-link verify
  carries the token as a **query** parameter, and `pathOf` strips query and hash before the
  completion line, so ADR-0006's `context.path` exposure genuinely does not apply. The Sentry
  `request.url` egress is a different path and is a Risk above, not this.

- **What I could not check.** I did not verify anything against `better-auth@1.7.1`'s actual source
  — magic-link TTL and single-use behaviour, session cookie caching, `trustedOrigins` defaults, and
  the shape of the TOTP/password factor check are all stated as *verify before Build*, not as
  findings. I also could not assess DD1–DD11: the deep dives are `_Written in Phase C._`, and the
  object-storage design (DD8), the contact-detail rejector's formats (DD3), and the session
  mechanism (DD5) are where a good half of this advisory has to land or fail to.
