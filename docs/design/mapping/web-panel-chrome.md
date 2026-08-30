# Web panel chrome lock

> Status: Owner-approved 2026-08-30 (SHO-261). T1 chrome signed off
> the same day (`internal evaluation only`): no mobile «Ще»; account
> dropdown instead of inline Вийти.
> Working canvas: [Shozee V2 — Web panel](https://www.magicpatterns.com/c/fdsqxjz1djvww5spay7zey) (SHO-262 Done).
> Mobile canvas is unchanged: [Showzy V2 mobile](https://www.magicpatterns.com/c/g4fsekajwwkeex3v612gvp)
> (ADR-0024). Do not add desktop screens to it.

Desktop company panel is **not** the mobile tab shell with a sidebar
glued on. It is a three-pane operational chrome. Phone «Ще» exists
because five tabs is the budget; web does not get a More dump.

## Pattern lock (master–detail)

At ~1280px and above:

1. **Nav** — left. Company switcher at top. Operational items, then a
   hairline, then Компанія. AI is a distinct `action` control, not an
   ink nav row. Account lives in the footer as a **dropdown**, not a
   nav destination. **Вийти is inside that menu**, never a one-click
   control beside the name.
2. **List** — ~320px second column. Filters / `+ Нове` live here when
   the section creates records. Selecting a row changes the detail
   pane; the list stays.
3. **Detail** — remaining width. Empty state when nothing is selected
   (“Оберіть елемент”).

Clicking a list row must not navigate away from the list.

**Single-pane exceptions** (no list column): AI dock/panel, company
onboarding / wizards, later Plate template editor.

Do not invent a stacked “list page → detail page → Back” flow for
desktop. Narrow/mobile web may collapse to list XOR detail; that is not
the T1 target.

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

Do **not** add Ще / More. Do **not** put Прайс-листи or Документи under
settings. Do **not** put **Вийти** next to the name in the footer.

## UX reference (pattern only)

[Master–detail example](https://www.magicpatterns.com/c/kputdkqv5aa9tguis1yxu3)
(Sophie / chat-based order management). Use it for the **three-pane
behavior**, not for tokens, IA, or components.

Do **not** fork that design as the working file. Do **not** copy its
navy sidebar, slate palette, or blue primary buttons.

## Visual language

Tokens and roles follow [`mp-to-mobile.md`](mp-to-mobile.md):

- Page `canvas` `#F7F6F2`, surface `#FFFFFF`, ink `#1C1C1A`
- `action` `#2F6FED` — AI, focus, selected-filter badges only
- Primary buttons are **ink**, pill radius
- System font, no webfont
- Nav sidebar stays warm (canvas/surface/ink), not navy

Auth copy conceptually matches mobile `i18n/auth.ts`. Nav **structure**
does not follow `i18n/panel.ts` tabs. Auth is phone/email OTP only
(ADR-0006). No Google, no guest.

T2–T7 fill the list and detail panes; they do not replace this chrome.
