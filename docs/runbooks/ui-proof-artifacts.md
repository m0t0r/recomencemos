# Runbook: the artifact store

What a human does once so that a Build session can publish recorded proof, and so that a review
artifact stops existing on its own afterwards. Everything here is a step an agent may not take —
provisioning, a credential, a public origin — which is why it is a runbook and a ticket rather than a
paragraph in the skill.

The decision behind it is
[ADR-0019](../adr/0019-ui-change-carries-recorded-proof-not-asserted-proof.md); the answers it works
from are `ui-evidence-hosting` and `ui-evidence-retention` in
[`../policy/build.md`](../policy/build.md), and this runbook sets none of them.

**Nothing in the pipeline creates any of this.** `scripts/ui-proof.mjs` refuses with exit 1 and names
this file when the bucket or its credentials are absent — before it makes a single network call, so the
refusal costs nothing. Five variables are involved: the four in §4's first block, which
`scripts/ui-proof-store.mjs` owns, plus `UI_PROOF_PUBLIC_BASE`, which the publisher owns because it is
where a link is built rather than where an object is written.

Until §1–§5 are done, `pnpm ui-proof publish --pr <number> --dry-run` is the only form that works, and
it works on a machine with no bucket, no keys and no network. `--pr` is required in every form; without
it the script exits 2.

## 1. The bucket

One bucket, in the Cloudflare account that already holds this product's other infrastructure.

```sh
# Dashboard: R2 → Create bucket.  Or:
npx wrangler r2 bucket create recomencemos-ui-proof
```

Location hint: leave it automatic. Nothing here is latency-sensitive — a reviewer opens the page once.

## 2. The two lifetime rules

This is the step that makes `ui-evidence-retention` true rather than aspirational, and the two rules
are not symmetric. **`review/` expires; `demos/` has no rule at all.**

| Prefix    | Rule                        | Why                                                                                                 |
| --------- | --------------------------- | --------------------------------------------------------------------------------------------------- |
| `review/` | Delete 30 days after upload | Review proof answers "did you check this", and that answer is spent once the pull request is merged |
| `demos/`  | **None**                    | A story demo answers "what does this look like working", which is a question that starts at merge   |

```sh
npx wrangler r2 bucket lifecycle add recomencemos-ui-proof \
  --name expire-review-artifacts --prefix review/ --expire-days 30
npx wrangler r2 bucket lifecycle list recomencemos-ui-proof   # confirm: one rule, prefix review/
```

**Check the prefix before you leave this step.** A rule with no prefix, or with the prefix left blank,
deletes the story demos too — and those are the artifacts with no other copy anywhere. The `list` call
above is the check, not a formality.

## 3. Public read, and what that means

The bucket serves unauthenticated reads: a reviewer opens the link without a Cloudflare account, and
so does anyone else holding it. That is the same shape GitHub's own attachments have, and it is why
the publisher generates an unguessable prefix segment rather than a tidy one.

Either an `r2.dev` subdomain (fastest) or a custom domain. Whichever you choose, the resulting origin
is what `UI_PROOF_PUBLIC_BASE` carries in §4.

```sh
# Dashboard: R2 → the bucket → Settings → Public access → Allow.
npx wrangler r2 bucket dev-url enable recomencemos-ui-proof
```

**Before enabling it, read "What a published artifact may never contain" in
[`../policy/security.md`](../policy/security.md).** Public read is what makes the enrolment route and
real personal data unpublishable rather than merely inadvisable, and this is the step where that
becomes true.

## 4. The credential, and where it lives

An R2 API token scoped to **this one bucket**, with **Object Read & Write** and nothing else. R2 →
Manage API tokens → Create.

It goes in the operator's shell environment and in the password manager, never in the repository:
`secret-store` in [`../policy/security.md`](../policy/security.md) is `fly secrets` mirrored in a
password manager with no secret in a repo `.env`, and `.claude/hooks/build-guard.sh` rule I refuses a
credential written into the tree. `.artifacts/` is gitignored; a credential file would not be.

```sh
# ~/.zshrc, a direnv file outside the repo, or the shell the session runs in.
export UI_PROOF_S3_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com"
export UI_PROOF_S3_BUCKET="recomencemos-ui-proof"
export UI_PROOF_S3_ACCESS_KEY_ID="<token access key id>"
export UI_PROOF_S3_SECRET_ACCESS_KEY="<token secret>"
export UI_PROOF_PUBLIC_BASE="https://<the origin from §3>"
```

**No CI secret is needed, and that is deliberate.** The captures are local and gitignored, so CI never
sees them and never uploads. `.github/workflows/ui-proof-expire.yml` only rewrites a line in a pull
request body and runs on `GITHUB_TOKEN` alone.

## 5. Prove it end to end

The one thing `pnpm test` cannot cover: the suite drives `--dry-run`, which reaches no store by
construction. This is where the remaining call is exercised.

```sh
mkdir -p "$(git rev-parse --show-toplevel)/.artifacts/ui-proof"
# Take a real capture rather than a placeholder — the publisher refuses anything
# under 1024 bytes, because that is what a recording interrupted by a missing
# ffmpeg leaves behind.
agent-browser open "$(pnpm --silent dev:origin)"   # the hostname `pnpm dev` printed for this tree
agent-browser screenshot "$(git rev-parse --show-toplevel)/.artifacts/ui-proof/before-smoke.png"

pnpm ui-proof publish --pr <a pull request you own> --dry-run   # lists the objects, touches nothing
pnpm ui-proof publish --pr <the same number>                    # uploads, then edits the body
```

Four things to confirm, in this order:

1. The link in the pull request body opens, unauthenticated, in a private window.
2. The page renders the pull request's own prose — if the body is empty, `gh api` sent the wrong flag
   and the report will look structurally fine while saying nothing.
3. A video, if you captured one, plays with controls. That is the whole reason this store exists.
4. Both prefixes hold what they should: `review/pr-<n>-<nonce>/` has the comparison page and its
   media, and `demos/pr-<n>-<nonce>/` has a page **of its own** plus the clips. The durable half has
   its own viewer on purpose — a page under `review/` would be deleted out from under the clips it
   renders.

Then close the pull request and confirm the body's line rewrites itself to say the artifact expired.
That is `ui-proof-expire.yml`, and it is the step most likely to be silently misconfigured, because
nothing else fails when it does.

## 6. What to do when it is wrong

| Symptom                                       | Where to look                                                                                                                        |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `the object store is not configured`          | §4. The message names the missing variables                                                                                          |
| `UI_PROOF_PUBLIC_BASE is not set`             | §4. The upload can succeed and still have nowhere to link                                                                            |
| The link 404s but the upload reported success | §3 — the bucket is private, or the public origin in §4 is not the origin §3 produced                                                 |
| The report renders with an empty body         | `gh` is unauthenticated, or the markdown call lost its stdin. `gh auth status` first                                                 |
| A story demo disappeared                      | §2. A lifecycle rule with no prefix. There is no second copy — this is the failure that is not recoverable                           |
| Nothing rewrote the link after a merge        | The workflow. It needs `pull-requests: write`, and it is a `pull_request_target` job, so it runs from the base branch and not the PR |

## 7. Turning it off

Remove the public access setting first and the bucket second. In that order: deleting a bucket while
its origin is still advertised leaves links that fail in a way nobody can diagnose from the pull
request. Revoke the API token, then remove the five variables from the operator's environment.

An artifact that is gone is not a problem the repository has to solve — the pull request bodies rewrite
themselves on close, and every merged pull request already carries its prose and its structural diff
sketch in git, which is the half this design deliberately never moved out of the repository.
