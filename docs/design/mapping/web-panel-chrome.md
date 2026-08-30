# Web panel chrome lock

> Status: Owner-approved 2026-08-30 (SHO-261). T1 chrome signed off
> the same day (`internal evaluation only`): no mobile «Ще»; account
> dropdown instead of inline Вийти. T2 (SHO-263) Orders owner pass,
> then a same-day polish lock: five-status pipeline, indigo
> «Підтверджено», list groups Активні / Закриті. T3 Catalog (SHO-264)
> owner pass (`internal evaluation only`): list price on the right,
> archived badge above the price, photo picker matching
> `catalog.setProductImages` / `files.requestUpload`. No storefront.
> T4 Customers (SHO-265) owner pass. T5 Price lists (SHO-266) owner
> pass (`internal evaluation only`). T7 Company (SHO-268) is on the
> canvas awaiting owner pass.
> Working canvas: [Shozee V2 — Web panel](https://www.magicpatterns.com/c/fdsqxjz1djvww5spay7zey) (SHO-262 Done).
> Mobile canvas is unchanged: [Showzy V2 mobile](https://www.magicpatterns.com/c/g4fsekajwwkeex3v612gvp)
> (ADR-0024). Do not add desktop screens to it.

Desktop company panel is **not** the mobile tab shell with a sidebar
glued on. It is a three-pane operational chrome. Phone «Ще» exists
because five tabs is the budget; web does not get a More dump.

## Pattern lock (master–detail)

Three panes on a wide canvas. Breakpoints are part of the lock, not a
later polish pass (owner, T2):

| Width | Layout |
| --- | --- |
| ≥1024px | Nav \| list (~320px) \| detail |
| 768–1023px | List \| detail; nav is a drawer (hamburger) |
| <768px | List **XOR** detail; **bottom tabs** (Sophie pattern); back returns to the list |

1. **Nav** — left on ≥1024px. Company switcher at top. Operational
   items, then a hairline, then Компанія. AI is a distinct `action`
   control, not an ink nav row. Account lives in the footer as a
   **dropdown**, not a nav destination. **Вийти is inside that menu**,
   never a one-click control beside the name. Tablet (`md`–`lg`) uses
   a hamburger drawer with that same nav. Phone (`<md`) uses a **bottom
   tab bar** (pattern from the Sophie reference): Замовлення, Товари,
   Клієнти, Прайс-листи, then **Більше** (Компанія, AI, Вийти). No
   hamburger on phone. Tabs stay visible on the detail screen.
2. **List** — ~320px when shown beside detail. Filters / `+ Нове` live
   here when the section creates records. Selecting a row changes the
   detail pane; on ≥768px the list stays.
3. **Detail** — remaining width is a **stage**, not a stretched form.
   Record content sits in a **centered card** (~34rem max) so fields
   stay compact. Empty state when nothing is selected (“Оберіть
   елемент”).

Clicking a list row must not navigate away from the list on ≥768px.

**Single-pane exceptions** (no list column): AI dock/panel, company
onboarding / wizards, later Plate template editor.

Prototype switcher includes viewport frames (Широке / Планшет /
Телефон). Pane collapse must follow the **shell width** (container),
not only the browser viewport, so those frames are honest.

## Order numbers

Display is `#PREFIX-TOKEN` (SHO-250), e.g. `#TM-K7K3K4`. Never a bare
sequence such as `#12`. Search may omit `#`.

## Order statuses (T2 canvas lock)

Pipeline: **Нове → Підтверджено → В роботі → Виконано** (or **Скасовано**
from any open status). List groups are **Активні** (`new`, `confirmed`,
`in_progress`) then **Закриті** (`done`, `canceled`). Do not title a
group with a status name («В роботі», «Завершені»).

| Status | Tone | Color |
| --- | --- | --- |
| Нове | `action` | `#2F6FED` / `#E8F0FF` |
| Підтверджено | `focus` | `#5B4BDB` / `#EEEBFF` |
| В роботі | `attention` | `#A65A16` / `#FBEFE1` |
| Виконано | `success` | `#237A4B` / `#E6F2EA` |
| Скасовано | `danger` | `#C0392B` / `#FBEAE7` |

`focus` is a web-canvas token; it is not yet in mobile Unistyles /
`StatusPill`. Shipped `orders.status` CHECK is still
`new | confirmed | canceled`. Do not implement the extra states without
a product/ADR pass.

## Catalog list (T3 canvas lock)

Cover thumb on the left. Name and variant count in the middle. Unit
price right-aligned. The **Архівний** badge stacks above the price
(same pattern as order status + total). Photo picker on detail/form:
ordered `fileIds`, cover = first, max 10, JPEG/PNG/WebP ≤10 MiB.

## Price lists (T5 canvas lock)

Staff UI over the existing five-level model, not a new pricing engine.
Named lists with per-product / per-variant entries. List: search by
name, chips Усі / Активні / Неактивні, empty and loading frames.
Empty field inherits catalog base; `0` is a stored price. Company
default is always active and cannot be deleted. Personal prices stay
on the client card (level 1).

## Company (T7 on canvas)

Компанія is a first-class nav item below the hairline. List pane:
Профіль, Реквізити, Команда — not tabs, not under Більше on desktop.
Profile: trade name, slug **display-only**, immutable prefix. Legal:
`company_legal_info` (ФОП/ТОВ). Team: membership/roles placeholder,
no RBAC editor. Stop: public profile, slug change, documents,
acquiring. Awaiting owner pass.

## Nav IA (owner-first web)

```
[company switcher]

Замовлення
Товари
Клієнти
Прайс-листи
────────────
Компанія

[ AI ]

[account ▾]   ← dropdown: theme (mock), Мій акаунт,
                 Сповіщення, Клавіатура, Допомога, Вийти
```

| Item | Role |
| --- | --- |
| Замовлення, Товари, Клієнти, Прайс-листи | Daily operations. First-class nav. |
| Клієнти | Groups, counterparties, invites are **list-pane tabs**, not sidebar rows. |
| Компанія | Low-frequency. List pane: профіль, реквізити, команда. |
| Документи | Later card. When it lands: operational row **above** the hairline, next to orders — not inside Компанія. |
| Чати, аналітика, acquiring | Not this panel’s primary nav. |
| Account menu | User-scoped: theme (mock), own profile, notifications, keyboard, help, sign-out. Not company / team / price lists. |

Do **not** add Ще / More to the **desktop sidebar**. Phone overflow is
**Більше** in the bottom tab bar (Sophie). Do **not** put Прайс-листи
or Документи under settings. Do **not** put **Вийти** next to the name
in the desktop footer.

## UX reference (pattern only)

[Master–detail example](https://www.magicpatterns.com/c/kputdkqv5aa9tguis1yxu3)
(Sophie / chat-based order management). Use it for the **three-pane
behavior**, not for tokens, IA, or components.

Do **not** fork that design as the working file. Do **not** copy its
navy sidebar, slate palette, or blue primary buttons.

## Visual language

Tokens and roles follow [`mp-to-mobile.md`](mp-to-mobile.md):

- Page `canvas` `#F7F6F2`, surface `#FFFFFF`, ink `#1C1C1A`
- `action` `#2F6FED` — AI control, focus rings, selected-filter badges,
  and the selected list-row fill (`actionSoft`)
- `focus` `#5B4BDB` / `focusSoft` `#EEEBFF` — order status «Підтверджено» (web canvas; not in mobile Unistyles yet)
- Primary buttons are **ink**, pill radius
- System font, no webfont
- Nav sidebar stays warm (canvas/surface/ink), not navy

Auth copy conceptually matches mobile `i18n/auth.ts`. Nav **structure**
does not follow `i18n/panel.ts` tabs. Auth is phone/email OTP only
(ADR-0006). No Google, no guest.

T2–T7 fill the list and detail panes; they do not replace this chrome.
