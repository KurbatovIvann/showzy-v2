# Incident response

> Skeleton for production (security-operations §6). Fill owners and
> notification channels before launch; do not invent a paging vendor
> here.

## Severity

| Level | Meaning | Examples | Owner |
| --- | --- | --- | --- |
| **SEV1** | Tenant isolation broken, credential leak, or data loss | Cross-tenant read/write in production; OTP/session secret in a public log; unrecoverable backup repository | Human owner, page immediately |
| **SEV2** | Availability or durability miss against published targets | API 5xx elevated; backup/PITR failure; RPO/RTO missed; dead-letter backlog growing across consumers | Human owner, start within 15 minutes |
| **SEV3** | Degraded, work around exists | Single-consumer dead deliveries; rate-limit fail-open on authenticated reads; a provider outage | Next business hours |
| **SEV4** | No customer impact | Sentry noise, a failed drill that still met targets after retry | Backlog |

`CoreInvariantError` / `INTERNAL` outcomes are treated as SEV1 until
proven otherwise — they are server bugs, including tenant mismatches.

## Owner

Until a rotation is published: the human owner of `KurbatovIvann/showzy-v2`.
The on-call channel and deputy are launch blockers (fnd-G1).

## Containment

1. Stop the bleeding: take the affected process out of the load
   balancer, disable the offending action via a feature flag when that
   module exists, or stop the worker if deliveries are the vector.
2. Do **not** delete logs, audit rows, outbox rows, or backup
   artifacts. `audit_log` is append-only for `showzy_app` on purpose.
3. For a suspected tenant leak: keep the API up for other companies if
   the action can be blocked; otherwise fail closed.

## Credential rotation

Rotate in this order, then invalidate sessions:

1. `BETTER_AUTH_SECRET` and session cookies (forces re-login)
2. `IP_HMAC_SECRET` (public rate-limit keys rotate anyway every 24h)
3. `DATABASE_URL` / `DATABASE_MIGRATE_URL` passwords
4. Redis AUTH, S3/R2 keys, Sentry DSN, backup-repository keys
5. Provider webhook secrets (when those modules exist)

OTP codes live only in TTL'd Redis — flushing Redis burns outstanding
codes. Record that as customer-visible (re-send OTP).

## Customer notification

SEV1 and SEV2 that exposed or may have exposed personal/financial data:
notify affected companies after containment, with what happened, what
data, and what we rotated. Do not include secrets, OTPs, or raw
payloads in the notice. Legal-copy specifics are a launch item.

## Evidence

Preserve: structured logs (`request_id`, actor, company, action), Sentry
events (already scrubbed), `audit_log` rows, `domain_events` /
`event_deliveries` for the window, backup repository listings, and the
deployed git SHA. Export before rotating the Sentry DSN.

## Post-incident

Within five business days: timeline, root cause, customer impact,
what the tests/specs missed, follow-up tickets. SEV1 always includes a
spec or test gap.
