# Invite — AI Journey

> Linear: SHO-27 · Context: external intent → Customer-company AI  
> Also applies: `entry-path-conventions.md`

## Purpose and path

Provide a conversational invite continuation while typed actions perform all
account-bound validation and acceptance.

1. Preserve opaque link intent through install and app launch.
2. AI yields to sign-in when needed.
3. Show an **Invite received** pending card, not an access claim.
4. Invoke typed validation for the authenticated account.
5. Show safely disclosed company identity and acceptance effect.
6. Hand off to a controlled classic confirmation.
7. Server revalidates and atomically consumes/records the invite.
8. Return a verified accepted result and visible company scope.
9. AI may now invoke only actions resolved for that company/customer context.
10. Create no CRM row; later checkout links/creates it.

## AI ↔ classic

Authentication, account switching, and confirmation are classic. **Open
company** uses the resolved target. Recovery can open Account or a safe support
surface. Model-visible state never contains the raw token.

## Journey-specific recovery and evaluation

Loading uses a persistent validation card. AI names received, validated, and
accepted as separate states. Unknown acceptance outcome refreshes before retry.
Wrong-account copy reveals no expected identity.

Internally verify state comprehension, arbitrary pasted-link denial, intent
restoration, one acceptance, and no invite-created CRM row.
