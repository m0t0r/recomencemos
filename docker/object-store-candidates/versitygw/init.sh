#!/usr/bin/env bash
# The two buckets, and the asymmetry between them — the same pair of acts
# `minio-init` performs and a human performs against R2 at go-live.
#
# Safe to re-run: a bucket is created only when absent, and the policy calls
# replace rather than add.
set -euo pipefail

aws configure set default.s3.addressing_style path

ensure_bucket() {
  aws s3api head-bucket --bucket "$1" 2>/dev/null || aws s3api create-bucket --bucket "$1"
}

ensure_bucket recomencemos-photos
ensure_bucket recomencemos-photos-quarantine

# Public read on the photos bucket, in whole: anonymous GetObject and nothing
# else, which is what an R2 public bucket grants — objects, never a listing.
aws s3api put-bucket-policy --bucket recomencemos-photos --policy file:///public-read.json

# The quarantine bucket carries no policy at all. Reasserted on every run, so a
# policy set by hand is removed rather than surviving the next `db:up`.
aws s3api delete-bucket-policy --bucket recomencemos-photos-quarantine

aws s3api get-bucket-policy --bucket recomencemos-photos --query Policy --output text
