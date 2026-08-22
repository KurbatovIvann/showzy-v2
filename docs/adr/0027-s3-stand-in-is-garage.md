# ADR-0027: S3 stand-in is Garage

- **Status**: Accepted
- **Date**: 2026-08-22
- **Deciders**: owner (+ Cursor Grok 4.6)
- **Amends**: ADR-0002, blueprint §3 Storage

## Context

Object storage is S3-compatible: signed URLs, one private bucket, prefixes
in the key. Production is Cloudflare R2. Local/CI needs a stand-in that
speaks the same API.

ADR-0002 named MinIO as that stand-in. MinIO's community Docker images
stopped being published in 2025 (the GitHub repo was archived in 2026), so
the compose file had already pinned last-released tags. Keeping those
images as a standing dependency, or switching to MinIO AIStor Free, would
tie local development to an abandoned or vendor-gated product.

SHO-108 (staff private file upload) decided the S3 API is the contract, not
a particular local daemon.

## Decision

Local and CI S3 is **Garage** (Deuxfleurs), pinned to a release tag of
`dxflrs/garage`, running single-node. Production stays **Cloudflare R2**.
One bucket (`S3_BUCKET`, local default `showzy`); purpose prefixes live in
the object key. Path-style addressing locally; R2 in production does not
require it. The website endpoint is not a product surface.

## Alternatives considered

- **Pinned MinIO community images as a standing dependency** — rejected:
  the images are last-released leftovers, not something we keep forever.
- **MinIO AIStor Free** — rejected: vendor product, not a local stand-in
  we control.
- **A second local store beside Garage** — rejected: one S3 endpoint, one
  bucket.
- **Change production off R2** — rejected: out of scope; the API is S3.

## Consequences

- `docker-compose.yml` runs Garage, not `minio/minio` / `minio/mc`.
- `packages/config` exposes `config.s3.bucket: string`. The v1 pair
  `S3_BUCKET_DOCUMENTS` / `S3_BUCKET_CHAT_ATTACHMENTS` is gone.
- Blueprint §3 Storage and ADR-0002 wording follow this decision.
- The AWS SDK and `packages/modules/files` land in later SHO-108 tickets;
  this ADR does not add them.
