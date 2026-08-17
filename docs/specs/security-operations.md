# Spec: security and operations foundation

> Status: Approved (frozen). Approved by: owner, 2026-08-17.
> Applies to phase 0 and every module. Written against blueprint §2.1/§3/§7,
> ADR-0006, ADR-0010, ADR-0012, and foundation specs.

## 1. Data classification and trust boundaries

- **Public:** published company/catalog/profile data.
- **Internal:** non-public business configuration and operational metadata.
- **Personal:** phone, email, names, addresses, chat, device identifiers.
- **Financial/legal:** requisites, orders, documents, payments, bank data.
- **Cryptographic/secret:** sessions, OTPs, API/provider credentials, QES
  private keys. QES private keys never enter the server boundary.

Untrusted inputs include every client field, chat/catalog/document content,
file upload, webhook, provider response, queue payload, event payload, and AI
tool result. Zod validation is necessary but never grants tenant access.

## 2. Authentication and sessions

- Better-auth is the only session authority. OTP codes are hashed at rest,
  expire after 5 minutes, allow at most 5 verification attempts, resend no
  faster than 60 seconds, and are never logged.
- Default OTP limits: 5 sends/hour per phone and 20/hour per IP, plus provider
  abuse controls. Responses do not disclose whether an account exists.
- Cookie sessions use `Secure`, `HttpOnly`, and appropriate `SameSite`; bearer
  tokens use OS secure storage on mobile. Session/device list and remote
  revocation are MVP requirements.
- Password/session/token changes invalidate affected sessions. High-risk
  actions may require recent authentication in addition to core confirmation.
- Staff active-company headers remain selectors verified against membership
  on every action (ADR-0013). Socket.IO/SSE room joins run the same
  principal/tenant authorization as HTTP actions.
- Hono trusts forwarded IP headers only from configured ingress proxies;
  direct/spoofed values are ignored. Public rate-limit keys use a rotating
  HMAC of normalized IP, and raw IP is not copied into domain logs/audit.

## 3. Files and object storage

- Clients never choose object keys. `files` issues short-lived signed uploads
  under a server-derived company/owner prefix, with single-use finalize.
- Every action declares size and MIME allowlists. Foundation defaults:
  10 MiB images, 25 MiB PDF/document/chat files; a module may lower them.
- Finalization verifies size, magic bytes, declared MIME, checksum, ownership,
  and object prefix. Executables and archives are denied by default.
- New uploads remain non-public/quarantined until validation and malware
  scanning pass. Scanner selection/dependency requires human approval.
- Downloads are signed, short-lived, disposition-safe, and authorization is
  rechecked when the URL is issued. Object keys and signed URLs are not
  durable action/idempotency outputs.

## 4. External services and webhooks

- Secrets come through validated env/secret management and are redacted by
  key/path policy before logs, Sentry, events, or audit.
- Webhooks verify signature, timestamp/replay window, provider account, and
  payload before constructing a system context. Provider delivery ID is the
  idempotency key.
- `pki-proxy` accepts no arbitrary destination URL. Host, scheme, port, path,
  redirects, DNS resolution, and private/link-local IP ranges are checked
  against an explicit allowlist to prevent SSRF.
- Outbound calls have timeouts, bounded retries with jitter, circuit/alert
  behavior, and correlation IDs. Retrying a side effect requires provider
  idempotency or reconciliation.

## 5. Environments, database, and release safety

- Production/staging/dev use separate credentials, buckets, Redis, databases,
  and provider projects. Production data is not copied to lower environments
  without an approved anonymization procedure.
- Runtime and migration DB roles, PITR, RPO/RTO, destructive migration policy,
  and restore drills follow `docs/specs/db.md`.
- Deploy order: compatible migration → application → deferred cleanup.
  Forward-only recovery never assumes an unsafe schema rollback.
- A staging migration rehearsal and reconciliation report are mandatory for
  every release containing a data migration; the full v1 cutover is rehearsed
  at least twice before launch.

## 6. Logging, detection, and incident response

- Structured logs contain request/correlation/action/accountable actor/channel
  and verified company scope, never raw OTPs, tokens, secrets, full documents,
  raw payment/webhook payloads, or unredacted personal input.
- Alert on sustained auth/rate-limit abuse, dead event deliveries, queue
  exhaustion, payment/provider reconciliation failures, backup failure,
  elevated 5xx, and cross-tenant invariant failures.
- Severity, owner, containment, credential rotation, customer notification,
  evidence preservation, and post-incident review are documented in the
  production runbook before launch.

## 7. CI and dependency controls

Every PR runs formatting, typecheck, ESLint/boundaries, unit/integration,
contract/event checks, migration drift/safety, secret scanning, and dependency
review. Lockfiles are committed. A new runtime dependency or external service
requires explicit human approval and a reason in the PR.

Sensitive changes (auth, payments, QES, webhooks, file authorization,
tenant/runtime protocols) require a separate security review and full human
review. A critical/high unresolved finding blocks merge.

## 8. Acceptance criteria

- [ ] OTP expiry/attempt/send/IP limits and non-enumerating responses are
      integration-tested.
- [ ] Session revocation and unauthorized Socket.IO/SSE room join are tested.
- [ ] Signed upload cannot cross company/owner prefix; size/MIME/magic-byte
      mismatch and executable/archive uploads fail.
- [ ] Webhook replay/invalid signature cannot create a system context.
- [ ] pki-proxy tests block redirects and public-host DNS rebinding to private,
      loopback, link-local, or metadata addresses.
- [ ] Redaction tests prove representative secrets/PII never reach logs,
      Sentry, events, or audit.
- [ ] Runtime DB role, backup restore drill, migration rehearsal, and
      reconciliation gates pass before launch.
- [ ] CI secret/dependency/security gates cannot be bypassed by ordinary PRs.

## Changelog

| Date | Change | Why | Reported by |
| --- | --- | --- | --- |
| 2026-08-17 | Initial foundation draft | Close phase-0 security/operations contract gap | GPT-5.6 Sol |
