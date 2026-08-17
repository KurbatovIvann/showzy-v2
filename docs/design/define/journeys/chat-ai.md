# Chat — AI Journey

> Status: Complete; pending DEFINE Approval #2  
> Linear: SHO-11 · Quadrants: Staff/AI, Customer/AI  
> Evidence: approved chat/order specs and internal assumptions only

## Context and preconditions

Staff AI starts from its company, conversation, order, customer, or
notification. Customer AI starts within one company from profile, conversation,
order/card, or notification.

- Visible role/company scope is authenticated and authorized.
- AI uses only exposed typed chat/domain actions.
- Names, message text, links, and IDs never provide authorization.
- Business chat and assistant chat remain separate surfaces.

## Shared path

1. User asks to find, understand, summarize, draft, or send in a conversation.
2. AI resolves role, company, conversation, and referenced object; ambiguity
   produces a focused question.
3. AI reads messages from `chat` and current order state from `orders`.
4. A structured result separates retrieved facts from AI explanation.
5. For communication, show recipient, company, conversation, and exact draft.
6. User revises or instructs Send; preparation alone changes nothing.
7. AI invokes the same idempotent send action as classic UI.
8. Show Accepted, Failed, or Pending from the tool result and link to the exact
   classic conversation.
9. The accountable user remains the sender; the counterpart receives a normal
   company-chat message, not assistant history.
10. Consequential order actions refresh current order state, then use the
    appropriate action or classic confirmation.

## AI ↔ classic handoffs

- Pass stable company, conversation, message, and object IDs; no copied state
  acts as authority.
- Open classic chat for full history, direct conversation, attachments, and
  structured object review.
- High-risk work always opens classic human confirmation.
- On return, refresh authoritative state before explaining outcome.
- Never insert AI prose silently or present AI as an independent participant.

## Ownership and recovery

- Assistant persistence may retain conversation/action references, not copied
  chat/order state.
- `chat` owns human conversation/read state; `orders` owns order state.
- AI summaries are explanations, not records of agreement.
- Loading shows object/company resolution and offers non-streaming completion.
- Empty state never fabricates a recap or exposes a staff-invisible draft.
- Distinguish model failure from action failure and never infer success.
- Offline allows only clearly labeled last-known content and unsent draft.
- Before retrying an unknown send, inspect prior result and reuse the same
  idempotency identity.
- Foreign conversations reveal nothing; unexposed actions hand off to classic
  UI.
- Refresh stale summary before any consequential action.

## Accessibility and internal evaluation

Semantically separate user text, AI explanation, retrieved messages, and tool
results. Announce execution/result once and provide labeled Open conversation,
Review draft, and Retry controls. Never use tone/color as success evidence.

Internally test role/company recognition, ambiguous targets, fact-vs-summary,
draft/revise/send, unknown outcome, classic handoff, permission/offline states,
screen reader, and AI never appearing as a participant. Label findings
`internal evaluation only`.
