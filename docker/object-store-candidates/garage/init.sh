#!/bin/sh
# The Garage counterpart of `minio-init` (#299 candidate): one layout, one key,
# two buckets, and website access on exactly one of them.
#
# Runs in `curlimages/curl` against the admin API, because the Garage image
# ships no shell. Every step reads before it writes, so a second run changes
# nothing and exits 0. That is a requirement rather than a nicety: as the dev
# store, `pnpm db:up` would re-run the init on every call, and `measure.sh`
# runs it twice to show it holds.

set -eu

ADMIN="http://garage:3903"
PUBLIC="recomencemos-photos"
QUARANTINE="recomencemos-photos-quarantine"

api() {
  curl -sS --fail-with-body \
    -H "Authorization: Bearer $GARAGE_ADMIN_TOKEN" \
    -H "Content-Type: application/json" "$@"
}

# The first 64-hex `"id"` in a response: a node id, a bucket id.
first_id() {
  sed -n 's/^[^"]*"id": *"\([0-9a-f]\{64\}\)".*/\1/p;
          s/.*"id": *"\([0-9a-f]\{64\}\)".*/\1/p' | head -n 1
}

# 1. A layout. A single node with no role serves nothing.
node="$(api "$ADMIN/v2/GetClusterStatus" | tr ',' '\n' | first_id)"
layout="$(api "$ADMIN/v2/GetClusterLayout")"
if printf '%s' "$layout" | tr -d ' \n' | grep -q "\"roles\":\[{[^]]*\"id\":\"$node\""; then
  echo "layout: node $node already has a role"
else
  api -X POST "$ADMIN/v2/UpdateClusterLayout" \
    -d "{\"roles\":[{\"id\":\"$node\",\"zone\":\"dev\",\"capacity\":1000000000,\"tags\":[]}]}" \
    >/dev/null
  version="$(printf '%s' "$layout" | tr -d ' \n' | sed -n 's/^{"version":\([0-9]*\).*/\1/p')"
  api -X POST "$ADMIN/v2/ApplyClusterLayout" -d "{\"version\":$((version + 1))}" >/dev/null
  echo "layout: applied version $((version + 1))"
fi

# 2. The key, imported with the id and secret `store.env` declares.
if api "$ADMIN/v2/GetKeyInfo?id=$KEY_ID" >/dev/null 2>&1; then
  echo "key: $KEY_ID exists"
else
  api -X POST "$ADMIN/v2/ImportKey" \
    -d "{\"accessKeyId\":\"$KEY_ID\",\"secretAccessKey\":\"$KEY_SECRET\",\"name\":\"recomencemos\"}" \
    >/dev/null
  echo "key: imported $KEY_ID"
fi

bucket_id() {
  api "$ADMIN/v2/GetBucketInfo?globalAlias=$1" 2>/dev/null | tr ',' '\n' | first_id
}

ensure_bucket() {
  id="$(bucket_id "$1" || true)"
  if [ -z "$id" ]; then
    api -X POST "$ADMIN/v2/CreateBucket" -d "{\"globalAlias\":\"$1\"}" >/dev/null
    id="$(bucket_id "$1")"
    echo "bucket: created $1" >&2
  else
    echo "bucket: $1 exists" >&2
  fi
  api -X POST "$ADMIN/v2/AllowBucketKey" \
    -d "{\"bucketId\":\"$id\",\"accessKeyId\":\"$KEY_ID\",\"permissions\":{\"read\":true,\"write\":true,\"owner\":true}}" \
    >/dev/null
  printf '%s' "$id"
}

# 3. The asymmetry. Website access is Garage's only anonymous read, and it is a
#    per-bucket switch — the same shape as R2's public access.
public_id="$(ensure_bucket "$PUBLIC")"
quarantine_id="$(ensure_bucket "$QUARANTINE")"

api -X POST "$ADMIN/v2/UpdateBucket?id=$public_id" \
  -d '{"websiteAccess":{"enabled":true,"indexDocument":"index.html"}}' >/dev/null
api -X POST "$ADMIN/v2/UpdateBucket?id=$quarantine_id" \
  -d '{"websiteAccess":{"enabled":false}}' >/dev/null

echo "website: on for $PUBLIC, off for $QUARANTINE"
