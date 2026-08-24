# Policy owners

Every file in this directory has an **owner role**. A concern raised while writing or reviewing a
`spec.md` names the role, never a person, so a spec written by one developer still routes correctly
once a team forms around it. Growing the team is an edit to the right-hand column and nothing else.

| Policy                           | Owner role     | Settles                                                                   | Who holds it |
| -------------------------------- | -------------- | ------------------------------------------------------------------------- | ------------ |
| [security.md](security.md)       | Security owner | Auth, sessions, threat-model scope, compliance, secrets                   | _unassigned_ |
| [data.md](data.md)               | Data lead      | Store, keys, classification, retention, migrations, cache ownership       | _unassigned_ |
| [operability.md](operability.md) | On-call lead   | Observability, alerting, SLOs, control bands, rollback                    | _unassigned_ |
| [ux.md](ux.md)                   | Design lead    | Accessibility, locales, voice, motion, the state set                      | _unassigned_ |
| [build.md](build.md)             | Repo owner     | Branching, merge rules, protected paths, what "done" means, stacked PRs   | _unassigned_ |
| —                                | Tech lead      | Architecture, module boundaries, ADR conflicts, arbitration between edges | _unassigned_ |

**Build policy belongs to the Repo owner, not the Tech lead.** Who may merge, what the remote
protects, and which paths an agent may not touch are properties of the repository rather than of the
architecture, and they are settled once for every effort instead of per spec.

The **Tech lead** owns no policy file on purpose. Architecture is settled per effort in the spec's
deep dives and, where it sets durable precedent, in an ADR under `docs/adr/` — not as a standing
table of values. The role exists here because it is the one that arbitrates when two edges reach
opposite conclusions.

Fill the right-hand column with a GitHub handle (`@octocat`) or team (`@acme/security`). While a
role is _unassigned_ every concern under it escalates to the repo owner, which is the correct
behaviour for a one-person project and a loud one for a team that has outgrown it.

## Writing a concern

A concern names the decision, the cost of getting it wrong, and the role that settles it:

```markdown
- [ ] **C1** — Per-user balance served from `use cache: remote` on the shared read path.
      **Risk if wrong:** one user's balance served to another after a cache hit.
      **Owner:** Security owner (with Data lead).
```

The **risk** line is what makes the list triageable: it is how an owner decides whether to answer
now or accept it. A concern with no risk stated is a question, and questions belong in the intent.

Where a concern exists because a key in this directory is `UNSET`, name the file and the key:

```markdown
- [ ] **C4** — Session lifetime for the authenticated read path.
      **Risk if wrong:** a revoked session keeps working until its token expires.
      **Owner:** Security owner. **Unblocks by setting:** `docs/policy/security.md` → `session-lifetime`.
```

That last line is what turns a recurring concern into a one-time decision: the second spec to hit
the same gap finds the key already set and never raises it again.

Leave every box unchecked. An owner checks a box and appends the answer inline when they resolve
it, exactly as with an intent's open questions. All boxes checked is what lets a human move the spec
to `status: approved`, which is the Design gate — and `.claude/hooks/design-to-build-gate.sh`
refuses that transition to an agent regardless of what it concludes.
