# List Item Contract

> Status: Approval #3 granted by the owner on 2026-08-17  
> Linear: SHO-16 · Object and task row

## Use and interface

Use for search results, settings, conversations, orders, documents, and queues.
Do not use as an unstructured container or hide unrelated actions behind one
row tap.

Conceptual inputs: stable item reference; navigation/selectable/queue/
informational variant; localized object identity; supporting text; textual
status/time; selected state; optional primary/child actions; queue reason, next
action, and recovery where applicable.

Compact/default/multiline layouts reflow at 200%. Applicable states: focused,
pressed, selected, unread, disabled, stale, pending, failed, unavailable.
Every state uses text plus icon/structure, never color alone.

## Behavior and content

- Row and child actions expose distinct semantics/44×44 targets.
- Swipe/long press always has visible keyboard-accessible equivalent.
- Insert, filter, reorder, paginate, and realtime update preserve focus/position;
  removal selects a predictable neighbor.
- Name object type/identity before status.
- Queue row exposes why it appears, time, next action, and recovery.
- Expose no IDs/enums/private existence.
- Container owns loading/empty; placeholder never impersonates an item.
- Pagination exposes progress plus Retry/Load more.
- Offline items show last sync/pending state and preserve identity on retry.

## Dual-flow, accessibility, and tokens

Classic is primary for Staff queues and Global/Customer lists. AI uses short
result sets; larger sets open classic. Staff prioritizes failed/blocking work;
Customer exposes owned objects; Global exposes published results.

List exposes name/count/grouping/boundaries; item position where useful.
Provide 3:1 focus, keyboard/switch/screen-reader, 44×44, 200%, and reduced
motion.

Use `colors.semantic.surface|text|border|status`, `typography.role.*`,
`space.*`, `dimensions.touch.minimum`, `radii.*`, and `motion.*` from
`tokens.md`.

## Acceptance

Identity/status/reason/action/recovery order, non-color states, and predictable
focus pass under realtime, filtering, pagination, removal, and scaled text.
