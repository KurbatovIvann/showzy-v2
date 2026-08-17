# Documents — AI Journey

> Status: Approval #2 granted by the owner on 2026-08-17  
> Linear: SHO-11 · Quadrants: Staff/AI, Customer/AI  
> Evidence: scope/architecture constraints and internal assumptions; no
> approved V2 documents/signing spec exists

## Context and preconditions

Staff AI starts from company, B2B order, conversation/card, or notification.
Customer AI starts within the company from order, conversation/card, document,
or guarded link.

- Authorized company/order context and applicable B2B capability exist.
- AI accesses only exposed typed actions and current legal/order facts.
- Classic routes exist for detailed review and signing.
- QES keys are physically inaccessible to AI and server.

## Shared path

1. User asks to prepare, find, generate, or explain an order document.
2. AI resolves role, company, order, counterparty, and document type; it asks
   when ambiguous.
3. Read current order/customer/company/document facts.
4. Separate retrieved facts from AI interpretation and list prerequisites.
5. Present a proposal with type, order, parties, items, amounts, effect, and
   missing fields.
6. Collect allowed structured fields; preparation creates no signature.
7. When supported, call the same draft/generation action as classic UI.
8. Show current Queued, Processing, Completed, or Failed document card.
9. AI may explain, but the exact artifact remains available for inspection.
10. For signing, explain signer/document/state and open classic confirmation.
11. Human reviews and signs locally or cancels; AI cannot execute signing.
12. On return, refresh signing and verification state before responding.
13. If another party must act, explain that current pending state without
    assuming an unsupported signing order.

## AI ↔ classic handoffs

- Pass stable company/order/document/counterparty IDs, not copied state.
- AI may prefill fields; user sees and confirms them in classic UI.
- Dense field review, artifact inspection, corrections, QES, and irreversible
  actions always use classic UI.
- AI never says “I signed” or “we signed.”

## Ownership and recovery

- AI owns no order/document/artifact/signature state. Source ownership remains
  in `orders`, `documents`, `doc-generation`, `doc-signing`, and `files`.
- Streamed explanation cannot imply completion before action result.
- Empty state explains unmet B2B prerequisites without inventing a document.
- Distinguish model, domain, generation, signing, and verification failures.
- Preserve confirmed inputs and successful stages.
- Offline AI can show labeled last-known information but cannot execute or ask
  for key upload.
- Refresh before repeating unknown create/generation/signing outcomes.
- Retry only the failed idempotent stage; signing requires classic review.
- Explain partial completion and who/what must act next.

## Accessibility and internal evaluation

Semantically separate instructions, interpretation, facts, proposals, and tool
results. Provide non-streaming completion and descriptive Review document /
Continue to signing controls. Never rely on color or legal-sounding AI tone.

Internally test disambiguation, prerequisite correction, one generation under
retry, state separation, classic signing boundary, no key request, refreshed
return state, partial success, and assistive technology. Exact AI-exposed
actions and signing behavior remain provisional until approved specs. Label
findings `internal evaluation only`.
