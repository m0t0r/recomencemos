#!/bin/sh
# The two buckets, and the asymmetry between them — the same acts a human
# performs against R2 at go-live runbook §3. `object-store-init` in
# `docker-compose.yaml` runs this, and says why it is plain `curl`.
#
# Safe to re-run, and `pnpm db:up` re-runs it every time: a bucket is created
# only when absent, and both policy calls replace rather than add.
set -eu

# Every request is signed the way the product signs: SigV4, region `auto`,
# service `s3`. `--fail-with-body` makes a refusal exit non-zero and print the
# store's own error, so a wrong key fails `pnpm db:up` rather than passing it.
s3() {
  curl --silent --show-error --fail-with-body \
    --aws-sigv4 "aws:amz:auto:s3" --user "$ACCESS_KEY_ID:$SECRET_ACCESS_KEY" "$@"
}

# HEAD first, so an existing bucket is left alone. Any HEAD failure falls
# through to the PUT, which then fails loudly if absence was not the cause.
ensure_bucket() {
  s3 --head --output /dev/null "$ENDPOINT/$1" 2>/dev/null || s3 --request PUT "$ENDPOINT/$1"
}

ensure_bucket recomencemos-photos
ensure_bucket recomencemos-photos-quarantine

# Public read on the photos bucket, in whole: anonymous `s3:GetObject` and
# nothing else, which is what an R2 public bucket grants — objects, never a
# listing.
s3 --request PUT --header "Content-Type: application/json" \
  --data-binary @/public-read.json "$ENDPOINT/recomencemos-photos?policy"

# The quarantine bucket carries no policy at all. Deleted on every run, so a
# policy set by hand does not survive the next `pnpm db:up`.
s3 --request DELETE "$ENDPOINT/recomencemos-photos-quarantine?policy"

# **The browser's presigned PUT is cross-origin, so quarantine answers its CORS
# preflight — for the development origins, with PUT and the two headers the
# upload sends, and nothing else.** Without a rule the gateway refuses every
# preflight with 403 and no photo ever arrives; the storage suite cannot see
# that, because Node's `fetch` sends no preflight (#316). It is a grant about
# who may *ask*, not who may write: the PUT still needs a valid signature.
#
# The gateway requires a `Content-MD5` on this call. The image has no
# `openssl`, so busybox computes it: hex digest, back to bytes, then base64.
cors_md5=$(md5sum /cors.xml | cut -d " " -f 1 | xxd -r -p | base64)
s3 --request PUT --header "Content-Type: application/xml" --header "Content-MD5: $cors_md5" \
  --data-binary @/cors.xml "$ENDPOINT/recomencemos-photos-quarantine?cors"

# The policy as the store now holds it, so the run's output shows the grant.
s3 "$ENDPOINT/recomencemos-photos?policy"
echo
