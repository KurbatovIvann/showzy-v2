# ADR-0022: `share` principal — unauthenticated capability-token writes

- **Status**: Accepted
- **Date**: 2026-08-19
- **Deciders**: owner
- **Amends**: ADR-0013 (adds a seventh principal). Does not weaken ADR-0020
(`public` stays read-only discovery/target reads).

## Context

Owner-first documents require a public handover page where a counterparty
**without a Showzy account** can (1) download the supplier-signed artifact
and (2) apply their own QES and persist the dual-signed container.

That write cannot use existing principals:


| Principal                           | Why it fails here                                                                                                                                             |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `public`                            | ADR-0013 / ADR-0020 / core.md: unauthenticated and **read-only**. No audit, no events, no mutations. A signature record needs all three.                      |
| `customer` / `account` / `consumer` | Require a session. The product forbids a login wall on the share page.                                                                                        |
| `staff`                             | Counterparty is not a member.                                                                                                                                 |
| `system`                            | `transport: internal`; HTTP must not mint a system context from a client body. Token lookup in the HTTP adapter would also be DB access outside the pipeline. |


QES keys stay on the device (ADR-0012). The server only **verifies and
stores** a client-produced container. The share URL is a capability token
(selector), never a `companyId` grant (blueprint §2.1-1).

## Decision

Add principal mode `share`:

- No session. Actor in access logs is `anonymous`.
- Company scope comes only from a typed `resolveTarget` over a hashed
capability token (same shape as `publicScope: target`).
- `permissions: []`. Authorization is: valid unexpired unrevoked token +
handler rules (for co-sign: cryptographic verification + party match).
- May `risk: read | write`. Writes are allowlisted in the owning spec,
`transport: client`, `aiExposure: internal`, `idempotent: true`,
`audit: true`, `emits` allowed. Fail-closed rate limits (same class as
public / mutations).
- Audit `actorType` stays `system` with `actorId: "share"` (foundation
`audit_log` only allows `user|system`). The verified certificate identity
(CN, org, tax id, role) MUST live in a redacted `auditSnapshot`.
- Idempotency principal key: `share:<tokenHash>`.
- Isolation suite: a token cannot read or write another document; mismatch
and expired/revoked tokens are `NotFoundError`; co-sign MUST NOT create
CRM rows.

Signature **ingest** (`doc-signing.submitShareSignature`) is `risk: write`,
not `high`. Legal intent is the on-device QES; the server verifies the
container against the frozen payload and stores it. Staff/AI supplier
signing in the panel remains `high` + confirmation (AI must not possess
keys — core.md §7).

`public` is unchanged and stays read-only. The share **page load** remains
`documents.getShared` (`public` + target token). The **co-sign submit** is
a `share`-principal action in `doc-signing`.

## Alternatives considered

- **Allow** `public` **writes** — rejected: every future public action would
be one metadata mistake away from an unauthenticated mutation; ADR-0020
discovery rules would no longer be mechanically true.
- **OTP / silent account** — rejected for this page: the owner required
handover without Showzy authorization. КЕП already identifies the signer.
- **Webhook-style HTTP →** `system` — rejected: duplicates the pipeline
(token lookup in `apps/api`), `system` is not a client principal, and
confirmation/idempotency/rate-limit keys would be invented ad hoc.
- **Use-count / consume-once on** `getShared` — rejected: `public` reads
cannot write. Download limits belong to pre-minted `files` URLs at
`createShare` time, not to the page GET.



## Consequences

- Core (Active) gains a seventh context factory, contract-check rules, and
  an isolation suite. `core.md` was amended 2026-08-19 (`/rework-spec`).
  Implementation is scaffold **fnd-T11B**. HTTP dispatch still needs
  `/rework-spec` on `contract.md`.
- `packages/contract` principal dispatch: `share` receives the token from
action input (resolver), not from `x-company-id` or a session.
- `doc-signing` spec must declare `prepareShareSign` (read) and
`submitShareSignature` (write) with this principal.
- Safer dual-sign UX: Showzy asserts "both parties" only when the
counterparty certificate tax id matches the frozen buyer snapshot.

