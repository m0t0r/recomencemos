# Policy

**This directory is the placeholder. The design skills are not.**

The Design stage splits its knowledge in two, and the split is what keeps either half honest:

- **Method** lives in `.claude/skills/*-design/` — how to model entities, how to threat-model a
  boundary, how to pick an SLI. It is craft, it is the same in every organization, and a downstream
  project never rewrites it.
- **Policy** lives here — the WCAG level, the auth provider, the retention regime, the alert
  destination. No template can know these, and guessing one is worse than naming the gap.

A skill that needs a value it finds here reads it. A skill that needs a value recorded as `UNSET`
**raises a flagged concern naming this file and the key**, and stops. It never picks a default, and
it never writes prose about the decision being "your organization's call" — that sentence is what
made the last attempt read like a form nobody filled in.

## Filling it in

Every key is either set or literally `UNSET`. That is a mechanical test, not a judgment call:

```sh
grep -rn UNSET docs/policy/
```

Day one of a new project, work that list down. Six short files is an afternoon; six prose
documents to rewrite is a quarter, which is why this is a table of keys and not an essay.

Not every key here starts `UNSET`, and there are **two different reasons** for that.

[`build.md`](build.md) carries a second table of values this template **fixes**, because a working
default exists and adopting it commits you to nothing — an `UNSET` branch-naming convention would stop
the first Build session of every new project over a question with no wrong answer. `UNSET` is for
decisions that carry consequence.

[`operability.md`](operability.md) is the other case: two of its keys — `observability-vendor` and
`log-level-production` — are **answered in the Keys table itself**, because the template ships running
code that already implements them. That is not a fixed value you may not reopen; it is a description of
what this repo currently does, and changing it is an ordinary decision with a stated cost
([ADR-0002](../adr/0002-reporting-vendor-seam.md) prices the vendor swap). The rule to take from it:
**a key is answered when the code answers it, and `UNSET` when the code leaves it open** — writing
`UNSET` next to a decision the repo has already made in code is the same failure as guessing.

Setting a key is a commitment: it stops being a concern on every future spec, and the design skills
start enforcing it instead of asking about it. Leaving one `UNSET` is a valid answer — it means
every spec that depends on it surfaces the question to the owner in `owners.md`, which is the
correct behaviour for a decision nobody has earned the right to make yet.

| File                             | Owner          | Covers                                                                             |
| -------------------------------- | -------------- | ---------------------------------------------------------------------------------- |
| [security.md](security.md)       | Security owner | Auth, sessions, threat-model scope, compliance, secret store, secrets in URL paths |
| [data.md](data.md)               | Data lead      | Store, primary keys, retention, migration policy                                   |
| [operability.md](operability.md) | On-call lead   | Observability vendor, alerting, on-call, default SLOs                              |
| [ux.md](ux.md)                   | Design lead    | Accessibility level, browser support, locales, voice                               |
| [build.md](build.md)             | Repo owner     | Branching, merge rules, protected paths, done, stacked PRs                         |
| [owners.md](owners.md)           | Repo owner     | Which role settles what, and the format a concern takes                            |
