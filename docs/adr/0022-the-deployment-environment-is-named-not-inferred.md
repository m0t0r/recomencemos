---
status: proposed
---

# The deployment environment is named, not inferred

About a dozen decisions in this repository ask "is this production?", and every one answers by reading
`NODE_ENV`. The log line's `env` field reads it, and so do Sentry's `environment` and sample rate, HSTS
in the response headers, the refusals of the development auth secret and of the responsible-party
placeholders, the proxied base URL, the notification transport and the startup notice that reports a
missing release.

`NODE_ENV` cannot answer that question, because Next sets it from the **command**, not the place.
`next build` and `next start` always run with `production`, and `next dev` always runs with
`development`. So a local `pnpm build && pnpm start` against the Docker database, CI's `pnpm build`,
and the Fly machine all read as production, and nothing could tell a future staging app from the
real one. `NODE_ENV` answers "how was this built", and the repository has been reading it as "where
is this running".

#327 is what made the gap matter. It needs a check that fails closed in production (refuse a database
URL that does not verify the server's certificate), and a check keyed on `NODE_ENV` would refuse every
local production build as well, while proving nothing about the machine it was meant for.

## The decision

**`ENVIRONMENT` names where the process is running, and every "is this production?" decision reads
it.** `NODE_ENV` keeps the meaning React and Next give it, which is the build mode, and nothing in
this repository's own code reads it any more to decide environment-dependent behaviour.

- **The values are a closed set: `development` and `production`.** Any other value, `prod` included,
  is refused when the variable is read. A typo stops the process instead of being silently
  treated as one of the two. `staging` is added when a staging app exists, not before.
- **Unset reads as `development`.** This keeps HSTS off `*.localhost`, which the header code is
  explicit about: HSTS pinned in a developer's browser is a browser somebody has to repair, and it
  reaches every other project they run.
- **Production does not rely on that default, because the image sets the variable in git.**
  `ENVIRONMENT=production` is written into the `Dockerfile`, in the stage that builds and in the
  stage that runs. The build stage needs it because a page prerendered during `next build` is decided
  at build time. It is not a `fly secret`: it is not secret, and a value set by hand is one that can be
  forgotten. `deploy-environment.test.ts` pins it, the same way it pins the `CMD` that strips
  `DIRECT_DATABASE_URL`.
- **One reader.** A single function parses and validates the variable, and each call site asks
  that function rather than repeating a string comparison.
- **It is declared in `turbo.json`'s `globalPassThroughEnv`.** Strict mode would otherwise filter it
  out of every task's environment, the failure [ADR-0018](0018-a-dev-server-is-reached-by-name-not-by-port.md)
  recorded for `PORTLESS`. It is not in `build`'s `env`: the image sets it inside `docker build`, where
  Turborepo's cache key is not in play, and hashing it locally would split the cache on a value that
  never varies there.

## Why the default and the fail-safe are different mechanisms

The two call sites that most need this pull in opposite directions. HSTS needs "unset" to mean
development, and the TLS check in #327 needs a production machine never to read as development. If
the default had to serve both, one of them would be wrong.

Setting the value in a committed file is what reconciles them. The default serves the developer, who
never sets anything. The committed `Dockerfile` line serves production, where the variable is present
by construction and a test pins it. Making the TLS check fail closed on "unset" would move #327's
problem one level up, from "nothing requires `verify-full`" to "nothing requires `ENVIRONMENT`".

## Consequences

**The log line's `env` field keeps its name and changes its source.** The name is part of the stability
contract, and its value now comes from `ENVIRONMENT`. On Fly both variables read `production`, so no
drain query or dashboard changes. Locally, a `next start` line now reads `development`, which is the
correct answer, where before it read `production`.

**The browser keeps `NODE_ENV` for now.** Client-side Sentry's `environment` is baked into the bundle
at build time, so reading `ENVIRONMENT` there would need a `NEXT_PUBLIC_` copy passed as a build
argument. On Fly both values read `production`, so server and client events agree today. They stop
agreeing the day a second deployed environment exists, and that day is when the browser moves over.

**Every call site moves in one change.** A repository where half the checks read one variable and
half read the other is worse than either, because a reader cannot tell which answer a given check
is getting.

## Alternatives rejected

**Keep `NODE_ENV`.** This is the status quo, and the problem described above.

**`ENV`.** A POSIX `sh` started interactively reads `$ENV` as the path of a startup file, and the
image's shell is `sh`. The name is also too generic to search for.

**Detect the host (`FLY_APP_NAME`).** It is present only on Fly, so it would work today. But it ties
application code to the hosting vendor, and a second Fly app for staging would read as production.

**Unset reads as `production`.** Failing closed everywhere is tempting for the security checks. It
would pin HSTS on `*.localhost` for every developer who forgot to set the variable, and it would make
setting it a required step of local setup, which is the step that gets skipped.

**A Fly secret instead of a `Dockerfile` line.** A value set by hand, visible nowhere in git and
checked by no test.
