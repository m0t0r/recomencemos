---
name: security-design
description: The security lens on a spec — secure by design, zero trust, least privilege. Trust boundaries, STRIDE, where authorization lives, what crosses to the client, secrets. Load when writing or advising on a spec.md.
---

# Security design

Three tenets carry this whole lens. Everything below is one of them made checkable **by reading
prose**, because at Design there is no code yet — only a document that either states a thing or does
not.

1. **Secure by design** — security is a property of the shape, not a control bolted on later.
2. **Zero trust** — never trust, always verify. Location and caller confer nothing.
3. **Least privilege** — every principal gets the minimum, and nothing inherits more by accident.

Policy — the auth provider, session lifetime, threat-model scope, compliance regime, secret store —
lives in `docs/policy/security.md`. A value recorded there as `UNSET` becomes a **flagged concern
naming the file and the key**. Never guess one, and never write a paragraph explaining that it is
the organization's call: name the key and move on.

**The Deploy counterpart is `/security-review`**, which audits the diff on a branch. Same three
tenets, different artifact. This skill audits prose; that one audits code. Neither replaces the
other, and a rule that belongs to both lives here.

---

## 1. Secure by design

### Name every trust boundary the change crosses

A boundary is any point where data arrives from somewhere less trusted than the code receiving it:
the browser, a webhook, a third-party API, a file upload, another team's service, a queue, an LLM
response. **A spec that adds a surface without naming its boundary has not been designed, it has
been sketched.**

### STRIDE, per boundary

For each boundary, walk the six and write down the ones that apply, plus **what in the design**
mitigates each. Not a list of controls to add later — a demonstration that the shape already handles
it, or a concern where it does not.

| Threat                     | Asks                                                  | Mitigated in the design by                              |
| -------------------------- | ------------------------------------------------------ | ------------------------------------------------------- |
| **S**poofing               | Can a caller claim to be someone else?                | Authentication, signature verification, webhook secrets |
| **T**ampering              | Can data be altered in transit or at rest?            | Integrity checks, parameterized queries, immutability   |
| **R**epudiation            | Can an actor deny having done it?                     | Audit records with actor, action, and time              |
| **I**nformation disclosure | Can someone read what they should not?                | Authorization, DTOs, what crosses to the client         |
| **D**enial of service      | Can one caller degrade it for everyone?               | Rate limits, timeouts, pagination caps, body size limits |
| **E**levation of privilege | Can a caller act beyond their role?                   | Authorization at the resource, scoped tokens            |

Three or four boundaries with two or three live threats each is a normal spec. Six clean rows of
"not applicable" means the walk was performed on autopilot.

### Abuse cases beside the user stories

For each `Must` story, write the mirror: **"As an attacker, I want to …"**. Same form, same section
style, concrete. `As an attacker, I want to request another tenant's account id, so that I can read
their balance.` One line each, and they are what makes threats legible to a reader who is not a
security person.

### Fail closed

Every decision point states its behaviour when the check **errors** or its dependency is **down** —
not just when it returns false. Default deny. A permission check that throws and is caught into a
permissive default is the failure mode that never shows up in tests, because tests exercise the
answer, not the outage.

### Validate at the boundary, once

Parse untrusted input into a typed value at the point it arrives, and let everything downstream
trust the type. Validation scattered past the boundary means some path reaches the data before it is
checked, and finding which one is a runtime exercise.

---

## 2. Zero trust

### Every read path states who may read it

"Anyone" is a valid answer written down and an invalid answer assumed. Same for every write.

**"It's internal" is not an authorization.** Neither is "only our own frontend calls it" — that is a
statement about intent, not about who can reach the endpoint.

### Authorize at the resource, not at the route

The stack makes this concrete, and each of these is a documented property of Next 16, not a
preference:

- **Proxy is not an authorization boundary.** (Middleware was renamed Proxy in Next 16; `proxy.ts`.)
  The docs are explicit that it is for *optimistic* checks and "should not be your only line of
  defense" — the majority of checks belong as close as possible to the data source.
- **A page-level check does not extend to the Server Actions defined on that page.** The page-level
  redirect controls which UI renders; the action is a separate entry point and re-verifies the
  caller on its own.
- **A Server Action is reachable by direct POST**, not only through your UI. Encrypted,
  non-deterministic action IDs and dead-code elimination reduce the exposure; they are not
  authorization.
- **A layout's check does not protect its child segments.** Do the check close to the data, or in
  the component that is conditionally rendered.

### Put the check in the data access layer

Centralize session verification and authorization in a DAL, so **every caller inherits the check**
rather than each route remembering it. The one that forgets is the one that ships. The spec names
the DAL function each read path goes through, and any path that bypasses it is a concern.

Return **DTOs, not rows**. The layer that authorizes is the right layer to decide which fields leave
it, and "we filter it in the UI" filters nothing.

### Assume breach

Ask the question explicitly: **what does an attacker holding a valid session get?** That is what
forces per-tenant and per-row scoping instead of hoping nobody enumerates ids. An entity with no
ownership edge (see `system-design`) cannot be scoped, and becomes an IDOR the first time it is
exposed.

---

## 3. Least privilege

### Enumerate the principals

Every one, each with the narrowest scope that works: the end user, each role, the service itself,
the build, the CI job, the database role, the agent. A principal nobody enumerated gets whatever the
default was.

### What crosses to the client is published

Props passed into a client component are serialized into the browser payload. So is anything a
Server Component renders. **The spec names the fields that cross, and treats all of them as
published** — a field hidden in the UI but present in the props is a disclosure, not a near-miss.

`system-design` says where the server/client line is; this decides what may pass it. Where the risk
is high, React's taint APIs (`experimental.taint`) are an extra layer — but they are a backstop, not
a substitute for filtering in the DAL.

### The cache is a privilege boundary

This is the least-privilege violation this stack invites most easily:

- `use cache` and `use cache: remote` are **shared across all users** and cannot read `cookies()`,
  `headers()`, or `searchParams` — runtime values must be passed in as arguments.
- So **an authorization check inside a cached scope runs once, and its answer is served to
  everyone** who hits that entry.

**Authorize outside the cached scope and pass the result in.** Per-user data belongs in
`use cache: private` or a store keyed by session, never in the shared remote handler. `data-design`
states the same rule from the ownership side; a read path breaking it is one concern under both.

### Secrets

- **A secret never reaches the client**: not in props, not in a `NEXT_PUBLIC_*` variable, not in a
  cached value a shared handler will serve to someone else.
- **One secret, one purpose, one rotation owner**, scoped per environment. A credential shared
  across two purposes cannot be rotated for one of them.
- **Name where each secret comes from and who rotates it.** Rotation requiring a rebuild is worth
  knowing at Design time — `.env*` files are Turborepo build inputs, so changing one invalidates the
  build cache.
- **A credential in the repo is an incident, not a finding.** Where a spec needs one to exist before
  Build starts, that is a concern with a named owner, not a TODO in a ticket.

### Time-bound and revocable

Every grant states its lifetime **and how it is revoked before that lifetime expires**. Both halves.
A session that cannot be killed until its token expires is a session you do not control, and "log
out" that only clears a cookie revokes nothing.

---

## Advisory output

When running as `security-advisor`, return analysis — never spec prose, never a finished section.
The architect writes the spec.

- **Recommend** — what the spec should settle, and the reasoning that makes it decidable.
- **Risk** — what the draft as written gets wrong, and the concrete failure it produces.
- **Concern** — what only the Security owner can settle, in `docs/policy/owners.md`'s format, with
  the `**Unblocks by setting:**` line where a policy key is the blocker.
- **Handoff** — what you need from another edge to finish an assessment. Say so rather than guessing
  it.

---

**Done when** every trust boundary the change crosses is named and walked through STRIDE, every read
and write path states who may reach it and where that is decided, every abuse case has a mitigation
or a concern, nothing secret or per-user crosses to the client or into a shared cache, and every
grant states both its lifetime and its revocation path.
