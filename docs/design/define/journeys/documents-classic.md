# Documents — Classic UI Journey

> Status: Complete; pending DEFINE Approval #2  
> Linear: SHO-11 · Quadrants: Staff/Classic, Customer/Classic  
> Evidence: scope/architecture constraints and internal assumptions; no
> approved V2 documents/signing spec exists

## Context and preconditions

Documents are a B2B add-on to an existing company, customer, order, and
conversation—not a separate product journey. Staff enter from an order,
conversation/card, document queue, or notification. Customers enter from their
company order, conversation/card, document area, or guarded link.

- Company, order, counterparty, and role stay visible.
- Required legal requisites and permissions/ownership are current.
- Launch uses default templates with structured-data editing.
- QES key material exists only on the human signer's device.

## Shared path

1. Staff opens an applicable document action from a B2B order/conversation.
2. Resolve order, company, customer, and legal profile.
3. Choose a supported default document type linked to that order/counterparty.
4. Prepare structured fields using immutable totals/requisite snapshots.
5. Review parties, items, amounts, currency, and missing prerequisites.
6. Create the document once through an idempotent action.
7. Show PDF generation as Queued, Processing, Completed, or Failed.
8. Staff reviews the generated artifact; chat/notification references its ID.
9. Customer opens the same current authorized document.
10. **Review and sign** shows signer, parties, exact document/version, legal
    effect, and consequence.
11. Human confirms, then client-side signing accesses the local key.
12. Signing records the artifact and verification result without receiving the
    private key.
13. Each required party completes a separate authenticated on-device step.
14. Events refresh cards/notifications; both sides can return to order/chat.

## Classic ↔ AI handoffs

- AI may identify the order, prepare fields, explain prerequisites/state, or
  summarize the document.
- Dense review, edits, artifact inspection, all irreversible actions, and QES
  signing open the exact classic surface.
- AI never receives key material or signs.
- After classic completion/cancellation/failure, refresh current state.

## Ownership and recovery

- `orders`, `documents`, `doc-generation`, `doc-signing`, and `files` retain
  separate source ownership. Chat/notifications store IDs only.
- Load identity first, then facts, artifact, and signatures independently.
- Distinguish no document, no artifact, and no signature.
- Identify which stage failed; generation failure does not undo the document.
- Offline may show safe dated summaries but blocks creation, generation,
  permission-sensitive changes, and signing.
- Retry only the failed stage using the existing document identity.
- Unknown signing outcome requires authoritative refresh and fresh human
  confirmation, never automatic retry.
- Show document created, artifact generated, signature pending/recorded, and
  verification result as separate facts.

## Accessibility and internal evaluation

Provide structured readable content alongside PDF; never require a visual
preview alone. Confirmation focus begins on document/signer/effect summary, not
Sign. Legal/signature state uses text, icon, and structure.

Internally test B2B applicability, missing requisites, generation failure,
chat/link entry, partial success, device-local signing, both parties, and
screen-reader/large-text use. Exact types/states/order remain provisional until
approved specs. Label findings `internal evaluation only`.
