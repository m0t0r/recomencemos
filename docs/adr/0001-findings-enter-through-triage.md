# Findings enter the loop through triage, not as intents

The playbook's Maintain stage has the agent write its diagnosis straight to `intent.md` in the
Stage 1 format, queued for a human to triage. We instead have findings arrive as GitHub issues
labelled `needs-triage` and run them through `/triage`, which promotes only some of them to a
numbered effort under `docs/efforts/`. Monitoring's characteristic failure is **recurrence** — the
same control-band breach firing again next week — and triage is the only part of either model that
answers it.

## Considered options

**An `intent.md` per finding, as the playbook describes it.** Captures the diagnosis in Plan format
at the moment it is written, which is what makes it triageable. Rejected because it collapses a
queue and a work register into one object: findings are generated automatically and most are
dismissed, so sequential numbering gets spent on noise and `docs/efforts/` stops meaning anything.
Dismissal is also terminal for one item only — the next identical finding arrives fresh, with
nothing to recognise it by.

**An issue, triaged (chosen).** `/triage` opens every assessment with a redundancy check (search the
codebase for the behaviour by domain concept, not by the request's wording) and a prior-rejection
check against `.out-of-scope/*.md`, so a dismissal becomes durable knowledge rather than a closed
issue nobody remembers. Its state machine is also richer than fix-now / schedule / dismiss:
`needs-info` returning to `needs-triage` on reporter activity is the common case for an anomaly
that needs one more data point before anyone can judge it.

## Consequences

- **The artifact chain is proportional to the work.** Triage has two exits: `ready-for-agent`
  straight to `/implement` for something small and clear, or `/to-intent` for something large or
  ambiguous. Most findings never become an intent, and that is the point — a three-artifact chain
  buys nothing for a one-line fix. Which exit is a human's call at triage.
- **A numbered folder under `docs/efforts/` means a human decided this is work.** The register stays
  readable because dismissed noise never reaches the repo.
- **Triage state lives on labels; `status:` in frontmatter only ever records approval.** The
  playbook's dismiss and schedule outcomes map onto `wontfix` and the `ready-for-*` labels, so
  neither fact gets two homes.
- **We lose the diagnosis being captured in Plan format at write time.** Mitigated by triage's own
  `AGENT-BRIEF.md`, which governs the structure of the brief attached to a finding.
- **The 3σ route stays deliberately ungated.** "Claude may act, though only by opening a PR into the
  review gate or triggering a pre-approved runbook" is the top exit with a control band in the human's
  place. Any enforcement added later gates `spec.md`, never a PR.
