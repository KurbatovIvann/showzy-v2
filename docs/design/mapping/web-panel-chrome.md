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
> canvas awaiting owner pass. T1 Documents (SHO-271) is on the canvas
> awaiting owner pass (`internal evaluation only`): nav row after
> Замовлення, list with type/signing chips, empty/loading frames.
> T2 Documents (SHO-272) is on the canvas awaiting owner pass
> (`internal evaluation only`): detail (PDF states, snapshots, cancel
> conflict) and create-from-order. T3 Documents (SHO-273) is on the
> canvas awaiting owner pass (`internal evaluation only`): share dialog
> (link shown once, rotate warning, QR + print, 90-day note) and public
> landing /d/{token} (unsigned, signed PDF + ASiC-E side by side,
> invalid link, cancelled). T4 Documents (SHO-274) is on the canvas
> awaiting owner pass (`internal evaluation only`): supplier QES
> signing flow (HITL confirm → key + password → certificate review →
> progress → signed), error states (expired grant, verify failure,
> offline), abandoned-request card on the detail. T5 Documents (SHO-275)
> is on the canvas awaiting owner pass (`internal evaluation only`):
> template list as a Документи list-pane tab (recommended), defaults,
> preview, create picker, system-only empty, and an annotated Компанія-row
> alternative (not recommended). T6 Documents (SHO-276) is on the canvas
> awaiting owner pass (`internal evaluation only`): Plate-style single-pane
> template editor — A4 page with print-margin hint and page breaks,
> variable chips with a grouped picker (auto vs fill-at-create), items
> table with column toggles, signatures block, sample-data preview,
> read-only system templates («Дублювати, щоб редагувати»), LeaveDialog
> on unsaved changes; tablet/phone get a read-only preview (SHO-269).
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
   Клієнти, Прайс-листи, then **Більше** (Документи, Компанія, AI,
   Вийти). No hamburger on phone. Tabs stay visible on the detail
   screen.
2. **List** — ~320px when shown beside detail. Filters / `+ Нове` live
   here when the section creates records. Selecting a row changes the
   detail pane; on ≥768px the list stays.
3. **Detail** — remaining width is a **stage**, not a stretched form.
   Record content sits in a **centered card** (~34rem max) so fields
   stay compact. Empty state when nothing is selected (“Оберіть
   елемент”).

Clicking a list row must not navigate away from the list on ≥768px.

**Single-pane exceptions** (no list column): AI dock/panel, company
onboarding / wizards, and the Plate-style template editor (T6 — a
full-shell takeover with its own back-to-templates header).

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

`focus` / `focusSoft` ship in mobile Unistyles and `StatusPill`.
Shipped `orders.status` CHECK is
`new | confirmed | in_progress | done | canceled`.

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

## Documents list (T1 canvas lock)

Operational row **above** the hairline, after Замовлення. Not inside
Компанія, not under settings. Phone: **Більше → Операції**, not a fifth
tab. Numbers `{prefix}-{РХ|ВН}-{seq:06}` (e.g. `TM-РХ-000012`). Status
is only **Виставлено** / **Скасовано** (no draft). Signing chip stacked
with status: **Без підпису** → **Очікує підпис** → **Підписано
постачальником**. List: **buyer/counterparty name is the row title**
(ink, 15px semibold); number + type and the absolute date sit under
it. Search by number/buyer; chips Усі / Рахунки / Накладні /
Скасовані; groups Виставлені / Скасовані. Type glyph on the left of
each row: receipt = рахунок (РХ), truck = видаткова (ВН). `+ Новий` opens
create-from-order (T2). Empty copy explains documents are created from
orders.

**Dates (list and detail):** always an absolute stamp
`DD.MM.YYYY, HH:mm` in Europe/Kyiv (day, month, year, hours, minutes).
Never relative labels («сьогодні», «вчора», «щойно») and never a
date without the year.

## Documents detail + create (T2 canvas lock)

Centered card stage. Header: number + type. Buyer/counterparty name
is the first line of the body (18px semibold ink), then the created
stamp and status + signing. PDF area has three generation-job states:
**Генерується**, ready (preview + **Завантажити** and **Друк** side by
side), **Помилка генерації** with retry. Snapshots (Постачальник,
Покупець, items) are read-only. Linked order opens order detail.
Actions: Поділитися (T3 stub), Підписати КЕП (T4 stub), Скасувати
(confirm; blocked when supplier-signed). Cancelled: muted; footer is
Завантажити + Друк only.

Create-from-order (`documents.createFromOrder`): `+ Новий` or order
action **Виставити документ**. Three steps — pick order (dropdown like
the order-form customer picker: collapsed trigger, search, list as a
**fixed overlay on top of the detail card** — not inside the card
scroll), type РХ/ВН + template, review → **Виставити**. No draft; the
number is assigned immediately. Guards: company legal missing (link
to Компанія → Реквізити); рахунок without a counterparty; same-type
document already issued («{тип} для цього замовлення вже є»). Never
lead that copy with «Живий».

## Documents share + public landing (T3 canvas lock)

Grounded in shipped `documents.share` / `documents.getShared` and
SHO-259 (signed file sits beside the PDF on the same token).

**Share dialog** (from document detail, action Поділитися):

- `documents.share` rotates the 90-day page token. The plaintext link
  `https://…/d/{token}` is shown **once**, with a copy button and an
  attention note that it cannot be retrieved later — only replaced.
- If an active link already exists, the dialog opens with a warning
  step first («Нове замінить його — попереднє одразу перестане
  відкриватися») before minting; primary is «Створити нове».
- Lifetime line: «діє 90 днів, до DD.MM.YYYY» (absolute Kyiv date).
- QR block for in-person handover + «Друк QR» affordance.
- Plain-language capability note: the page opens without sign-in;
  anyone with the link sees the document. Never «посилання надало
  доступ» phrasing.
- Detail shows a persistent hint when an active link exists («Є активне
  публічне посилання… лише створити нове»).

**Public landing `/d/{token}`** — counterparty, no account:

- Standalone chrome: minimal Shozee-branded header, single centered
  column (~36rem), no panel nav, no sign-in prompt. Phone-first:
  cards stack under `sm`.
- Summary card: type (eyebrow), number, absolute issued stamp,
  Постачальник → Покупець, «Разом» total.
- Files: PDF download card; when supplier-signed, `document.asice`
  card sits **beside** the PDF (never replacing it) with a КЕП/ASiC-E
  explainer (container = PDF + КЕП, verify via any КЕП verification
  service e.g. czo.gov.ua; Shozee does not issue signatures — never
  imply Shozee is a КНЕДП).
- Expired, rotated, and unknown tokens are one indistinguishable state:
  «Посилання більше не діє» + «зверніться до постачальника». No
  document facts are disclosed.
- Cancelled document: danger banner «Постачальник скасував цей
  документ», status pill Скасовано; files stay downloadable for
  reference.
- No buyer sign button on the landing (ADR-0022 co-sign is a later
  card). No chat delivery, no e-mail sending.

## Documents supplier QES signing (T4 canvas lock)

Grounded in `documents.requestSign` (HITL, risk high, 15-minute grant)
→ `docSigning.start` (frozen digest) → on-device signing →
`docSigning.complete` (ASiC-E verified). Key material never leaves the
device; Shozee is never presented as a КНЕДП.

**Entry** — Підписати КЕП on the detail is enabled only for `issued` +
PDF ready + not signed + no live request. Cancelled, generating, and
already-signed documents get a disabled button (signed detail also
carries an explainer that cancel is no longer possible).

**One dialog, phased** (over the detail pane, same shell as share):

1. **HITL confirm** — what will be signed (номер, тип, покупець,
   разом), attention note «після підтвердження у вас є 15 хвилин»,
   plain-language line that signing happens on this device and the key
   never leaves the computer. Primary «Підтвердити». Confirming flips
   the chip to Очікує підпис (the grant exists even if the dialog is
   closed later).
2. **Key step** — file picker (`.p12, .pfx, .jks, .dat`), CA
   autodetect line («ЦСК визначено: …»), password field. Inline
   errors, each reachable via a demo file in the prototype picker:
   unsupported container, empty/wrong password (field-level), expired
   certificate (block-level, with the expiry date and «отримайте новий
   ключ у вашого ЦСК»). Prototype password: 123456.
3. **Certificate review** — CN, РНОКПП, organization, CA, validity;
   «Підпис буде накладено від імені цієї особи»; Назад / Підписати.
4. **Progress** — Готуємо документ до підпису… → Підписуємо на
   пристрої… → Надсилаємо підписаний контейнер… → Перевіряємо підпис…
   (auto-advancing, key-stays-local footnote).
5. **Success** — «Підписано КЕП», signer CN + absolute stamp,
   `document.asice` saved beside the PDF; when an active share link
   exists, a hint that the link now also serves the signed file
   (SHO-259). Chip flips to Підписано постачальником.

**Errors** (dedicated switcher screens, each with close + retry):
grant expired («Час на підписання вичерпано» → Запросити знову, back
to confirm), verification failure («Не вдалося перевірити підпис» →
key step), offline («Немає з'єднання» → retry upload). All state the
document stayed unsigned and unchanged.

**Abandoned request** — detail of a pending document shows an
attention card («Запит на підписання створено {stamp}. Вікно діє 15
хвилин…») with Продовжити підписання (jumps to the key step) and
Скасувати запит (confirm dialog; document returns to Без підпису).

**Detail after signing** — a Підпис section with the `document.asice`
row (КЕП · CN · stamp, Завантажити) and, when shared, the note that
the active public link serves the signed file beside the PDF.

Seed fix note: the T1 seed had a PDF-generating document also marked
Очікує підпис, which the domain forbids (requestSign needs PDF ready).
The pending-signature demo now lives on its own seeded document; the
generating one is Без підпису.

## Documents templates (T5 canvas lock)

**Шаблони** live as **list-pane tabs** inside Документи (`Документи | Шаблони`).
Do **not** add a sidebar row. A Компанія list row is an annotated
alternative only (prototype frame «Шаблони в Компанії», marked
Не рекомендовано).

List grouped by type (Рахунок на оплату / Видаткова накладна). Rows:
name, type glyph (receipt = РХ, truck = ВН), Системний vs Власний, Типовий (one default per company+type).
Actions: set default, duplicate system → custom (the T6 edit entry),
rename and delete custom; system templates are read-only, with an
explanation instead of a silent disable. Preview is a sample with
placeholder tokens — not the Plate editor. Create-from-order step 2
uses the live catalog: default preselected, source and default badges.
Empty = only system defaults, invite to duplicate. Groups scale to
later types (договір, акт); only РХ/ВН appear on the canvas.

## Template editor (T6 canvas lock)

The **single-pane chrome exception**: a full-shell takeover over the
panel (no nav, no list), its own header — back to the template list,
template name + type + Системний/Власний/Типовий pills, «Перегляд»
toggle, ink «Зберегти» (enabled when dirty; saved state shows an
absolute stamp). Back with unsaved changes reuses the LeaveDialog
pattern.

- **Page canvas**: A4-proportioned white page on a muted stage,
  dashed print-margin hint («поле друку», edit mode only), «Сторінка
  N з M» captions. «Розрив» inserts a page break — a labeled dashed
  marker between pages, removable in place.
- **Toolbar**: paragraph/H1/H2, bold/italic, bullet/numbered lists,
  alignment (apply to the selected text block), then inserts: Змінна,
  Абзац, Позиції, Підписи, Таблиця, Розрив. Selected blocks get
  move-up/down/delete controls; text is editable inline (commit on
  blur).
- **Variable chips** (`documentVariable`): inline `{Назва}` chips,
  group-tinted like the v1 catalog — Компанія (action), Контрагент
  (success), Документ (focus), Замовлення (attention). Solid soft
  fill = auto-filled; dashed outline + pen glyph = fill-at-create
  (контрагент, місто). Picker groups the v1 catalog fields (назва,
  ЄДРПОУ/РНОКПП, адреса, IBAN, банк; номер/дата/місто;
  номер/дата/сума) with search and «авто» / «при створенні» badges.
- **Items table** (`itemsTable`): header Назва/К-сть/Ціна/Сума with
  per-column visibility toggles (min one visible), token row in edit
  mode + hint that rows come from the order, «Разом» row bound to
  `{Сума замовлення}`.
- **Signatures** (`documentSignatures`): supplier/counterparty
  signature lines rendered in the document body.
- **Preview**: substitutes sample data (how the generated PDF will
  look); explicit line that real values are filled at create time.
- **System templates** are read-only in the editor: banner +
  «Дублювати, щоб редагувати» (duplicates and reopens the editor on
  the copy — the same T5 entry point).
- **Tablet/phone** (<1024px shell width): read-only sample preview
  with «редагування макета доступне на комп’ютері» (mobile editing is
  the SHO-269 spike).

Annotated open question for the owner (`internal evaluation only`,
shown on the canvas): the editor is a близький макет, **not** a
WYSIWYG guarantee against the shipped `@react-pdf/renderer` layouts.
Conditional blocks and hint placeholders from v1 are noted as a future
extension, not designed here.

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
Документи
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
| Замовлення, Документи, Товари, Клієнти, Прайс-листи | Daily operations. First-class nav. |
| Клієнти | Groups, counterparties, invites are **list-pane tabs**, not sidebar rows. |
| Компанія | Low-frequency. List pane: профіль, реквізити, команда. |
| Документи | Operational row **above** the hairline, after Замовлення. Phone: Більше → Операції. Not inside Компанія. List-pane tabs: Документи \| Шаблони (T5). |
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

T2–T7 and documents T1–T6 fill the list and detail panes; they do not
replace this chrome.
