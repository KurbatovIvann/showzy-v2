# Order — AI Journey

> Status: Complete; pending DEFINE Approval #2  
> Linear: SHO-10 · Quadrants: Staff/AI, Customer/AI  
> Evidence: approved constraints and internal assumptions only

## Context and preconditions

AI starts globally for discovery or within a visible Staff/Customer company
scope from a product, cart, order, conversation, or notification. AI is an
action channel for the authenticated user, not a principal.

- Only exposed typed actions are available.
- Order creation requires an account and online current-state checks.
- Every write has a structured proposal; dense/high-risk review opens classic
  UI.
- Company, role, target, and action state stay visible.

## Customer path

1. Describe a product/order intent.
2. AI identifies Global or Customer scope and calls the same discovery,
   catalog, pricing, cart, and order reads as classic UI.
3. Current product/cart cards retain stable domain IDs.
4. Before a cart mutation, show company, product, variant, quantity, and
   expected effect.
5. If sign-in is required, preserve intent, authenticate, and refresh
   availability/price.
6. Gather simple fields conversationally; send dense address, delivery, and
   cart review to classic UI.
7. Show final company, items, total, delivery, and redirect-to-chat proposal.
8. After explicit approval, call idempotent checkout once.
9. Show verified completion evidence and open the existing conversation/order
   card.

## Staff path

1. Resolve the active company and requested customer/order; ask when
   ambiguous.
2. Read and summarize current order state.
3. Prepare manual creation or a valid lifecycle action.
4. Show customer, company, order/items, totals, target state, and consequence.
5. Send dense editing/high-risk work to classic confirmation.
6. Report only committed action results; resulting events refresh projections.

## AI ↔ classic handoffs

- Carry stable company/cart/order IDs, role, return route, draft fields, and
  mutation-attempt identity.
- Classic UI handles sign-in, item comparison, delivery, audit review, and
  final consequential confirmation.
- On return, AI refreshes current state before explaining or retrying.
- Assistant history may retain action references, never authoritative state.

## Recovery and boundaries

- Streamed prose never claims completion before the tool result.
- Repeated/rephrased requests during a pending write reuse one attempt.
- Unknown outcome triggers a state read before same-key retry.
- If checkout succeeded but chat projection failed, retry only projection
  loading.
- Offline AI may prepare a labeled unsaved draft but executes nothing.
- Permission denial cannot reveal foreign data or be bypassed by a company ID.
- `orders` remains canonical; chat, AI, queues, and notifications are
  projections.

## Accessibility and internal evaluation

Provide stable structured cards and a non-streaming final response. Announce
tool start/result and distinguish Prepared, Submitted, and Completed. Cards
expose company, object, status, total, and action without color dependence.

Internally test shared cart parity, auth restoration, one checkout, Staff and
Customer handoffs, repeated prompts, stale cards, offline, permission denial,
and screen-reader use. Label findings `internal evaluation only`.
