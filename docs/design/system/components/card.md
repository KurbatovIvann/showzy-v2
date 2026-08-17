# Card Contract

> Status: Complete; pending SYSTEM Approval #3  
> Linear: SHO-16 · Domain, proposal, and result surface

## Use and interface

Use to group one domain object, AI proposal, verified action result, or related
information with clear source and action. Do not use for decorative nesting or
copied ownership of domain state.

Conceptual inputs: domain-object/AI-proposal/AI-result/information kind; stable
card and optional object reference; title; ordered current facts; resolved
domain status; operation state; domain/system/AI/human authorship; independent
actions; required classic route for AI cards; result evidence before success.

Operation states: preparing, ready, queued, running, awaiting confirmation,
succeeded, failed, cancelled, partial. Domain and operation state remain
distinct. Compact/default/expanded cards reflow at 200%; dense work opens
classic UI.

## Behavior and content

- A card with child actions is not one button; actions are separately focusable.
- Streaming/realtime does not steal focus; announce meaningful transitions.
- Domain cards refetch current state by stable ID.
- AI proposal describes intended effect and changes nothing.
- AI result reports verified tool evidence; information never resembles
  completion.
- Lead with identity, state, facts, then next action.
- AI never implies authorization, signing, payment, or completion prematurely.
- Loading guesses no facts; error preserves confirmed facts and one recovery.
- Offline shows freshness; unknown mutation refreshes before retry.

## Dual-flow, accessibility, and tokens

Classic uses canonical summaries, queues, chat projections, guarded
destinations. AI proposals/results have equivalent text and labeled classic
route. All contexts resolve only authorized facts.

Expose named region/group, heading, state, time, action, recovery, 44×44
actions, 3:1 focus, keyboard/switch/screen-reader, 200% reflow, non-color state,
and reduced motion.

Use `colors.semantic.surface|text|border|status|risk|context`,
`typography.role.*`, `space.*`, `radii.*`, `elevation.*`, and `motion.*` from
`tokens.md`.

## Acceptance

Domain/proposal/running/partial/failure/verified-result are distinct; cards
retain IDs, never copied truth; AI fallback/classic route and stable focus pass.
