# Security policy

Owner: **Security owner** ([owners.md](owners.md)). Read by `security-design`.

An `UNSET` value is raised as a flagged concern naming this file and the key. It is never guessed.

| Key                    | Value   | What it settles                                                                                                                                                                                                                                                             |
| ---------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth-provider`        | `UNSET` | Who issues and verifies identity. Until set, no spec can say where a session comes from or how it is revoked                                                                                                                                                                |
| `session-lifetime`     | `UNSET` | How long a session stays valid, and how it is revoked **before** that expiry. Both halves, or the value is not set                                                                                                                                                          |
| `mfa-requirement`      | `UNSET` | Which principals must present a second factor, and for which operations                                                                                                                                                                                                     |
| `threat-model-scope`   | `UNSET` | Which adversaries are in scope. "Anyone on the internet" is a real answer; so is "authenticated tenants only"                                                                                                                                                               |
| `compliance-regime`    | `UNSET` | SOC 2, HIPAA, GDPR, PCI, none. Drives retention in [data.md](data.md) and what a breach obliges you to do                                                                                                                                                                   |
| `secret-store`         | `UNSET` | Where secrets live and who can rotate each one. `.env` files are Turborepo build inputs — rotation invalidates cache                                                                                                                                                        |
| `csp-policy`           | `UNSET` | The Content-Security-Policy the app ships, or an explicit decision not to ship one                                                                                                                                                                                          |
| `dependency-policy`    | `UNSET` | What blocks a release: a CVE severity threshold, a licence allowlist, or neither                                                                                                                                                                                            |
| `pentest-cadence`      | `UNSET` | How often an external party looks, if ever                                                                                                                                                                                                                                  |
| `secrets-in-url-paths` | `UNSET` | Whether any route carries a credential in a path segment — password reset, signed invite, unsubscribe. If yes, the completion line logs it verbatim ([ADR-0006](../adr/0006-name-the-exposure-rather-than-ship-a-heuristic.md)) and the path must be bounded before go-live |

## Already settled by the stack

These are not `UNSET` and not open. They come from the framework, so a spec contradicting one is a
concern rather than a preference.

| Fact                                                                  | Where it comes from     |
| --------------------------------------------------------------------- | ----------------------- |
| Every Server Action is a public endpoint and authorizes independently | Next.js App Router      |
| `use cache` / `use cache: remote` are shared across all users         | Cache Components        |
| Middleware is not an authorization boundary                           | Next.js App Router      |
| Anything passed to a client component is in the browser payload       | React Server Components |
| Secrets never reach `NEXT_PUBLIC_*`                                   | Next.js build           |
