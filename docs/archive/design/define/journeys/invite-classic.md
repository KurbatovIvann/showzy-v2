# Invite — Classic UI Journey

> Linear: SHO-27 · Context: external intent → Customer company  
> Also applies: `entry-path-conventions.md`

## Purpose and path

Preserve an opaque invite through install/sign-in, validate it for the current
account, obtain explicit acceptance, and enter the intended company.

1. Open the Universal/App Link.
2. Route to the app or a small install landing.
3. Restore opaque invite intent after install/restart.
4. Sign in if needed without losing intent.
5. Validate token status, expiry, account constraints, and company availability.
6. Show safe company identity and the exact acceptance effect.
7. User accepts explicitly.
8. Server revalidates and atomically consumes/records the invite.
9. Enter the resolved Customer company context and fetch current data.
10. Create no CRM row; later checkout links/creates it.

## Classic ↔ AI

After validation, **Ask AI** opens resolved company scope. Sign-in, account
switching, and acceptance remain classic human-controlled surfaces. The raw
token is never passed to AI.

## Journey-specific recovery and evaluation

Distinguish expired, revoked, already-used, wrong-account, offline, and
unpublished-company states. Deactivated product intent may fall back only to
an otherwise authorized company destination.

Internally verify install, OTP, restart, account switch, single acceptance,
company scope only after validation, and no invite-created CRM row.
