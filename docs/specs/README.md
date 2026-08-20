# Protocol manuals

These files document **already-frozen** foundation packages. They are not
a `/spec` stage and not a Living/Active/Mixed conveyor (ADR-0023).

New domain work uses `/feature`. The executable contract is
`*.contract.ts` plus the tests in the definition of done. Domain novels
that used to live here are research in `docs/archive/specs/`.

## What stays

| File | Documents |
| --- | --- |
| `core.md` | `packages/core` action runtime |
| `contract.md` | `@showzy/contract` client/server boundary |
| `db.md` | `packages/db` schema conventions, roles, capabilities |
| `money.md` | Money snapshot rules |
| `security-operations.md` | Auth, logging, backups, rate-limit numbers |
| `companies-foundation.md` | Companies/RBAC foundation slice |

Change a protocol manual when a test proves it wrong (same PR) or when
an ADR changes the runtime. Do not add new domain modules here.

## What moved

`catalog`, `companies`, `customers`, `orders`, `chat`, `pricing`,
`documents`, `payments`, `search`, `feature-flags`, and the old spec
template live in `docs/archive/specs/`. Planner may read them like
`docs/reference/`. They are not authority.
