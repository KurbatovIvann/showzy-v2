# Glossary — Ukrainian tax terms

Repository documentation is English (AGENTS.md), but the sources are
Ukrainian and the terms are not translatable one-to-one. This file keeps
the original term as the key, so that a reader of a topic file can follow
a source without guessing.

**These entries are orientation, not findings.** They carry no S/V/C
block and must not be cited as evidence. Anything load-bearing is stated
in a topic file with its source. Entries are corrected as research
proceeds — a wrong translation here is a bug worth fixing.

| Term | Working translation | Note |
| --- | --- | --- |
| ДПС | State Tax Service | The authority; `tax.gov.ua` |
| Електронний кабінет | taxpayer e-cabinet | `cabinet.tax.gov.ua`; both a human UI and, reportedly, a programmatic surface — scope to be established in T4 |
| РРО | cash register (hardware) | The classic device |
| ПРРО | software cash register | The software equivalent; the fiscalisation protocol we care about (T3) |
| фіскальний сервер | fiscal server | The ДПС endpoint a ПРРО talks to |
| фіскальний номер | fiscal number | Identifier assigned to a fiscalised document |
| зміна | shift | The open/close envelope around a day's receipts |
| Z-звіт | Z-report | Shift-closing summary |
| чек | receipt | The fiscalised sale document |
| квитанція | acknowledgement receipt | Response to a submitted document; the №1/№2 pair is the async model in T4 |
| КЕП | qualified electronic signature | The gate on every tax channel (T2) |
| ЦЗО | central certification authority | Publishes the CA registry our `packages/document-signing/src/pki/ca-registry.ts` already consumes |
| Дія.Підпис | Diia.Signature | Mobile-app-based qualified signature |
| ФОП | sole proprietor | The dominant customer shape for us |
| ЄП | single tax | Simplified taxation regime; groups 1–4 |
| ПДВ | VAT | |
| ЄСВ | unified social contribution | |
| ЄДРПОУ | business entity registry code | Identifier for legal entities |
| РНОКПП / ІПН | individual taxpayer number | Identifier for individuals |
| декларація | tax return | |
| наказ | ministerial order | The instrument that changes formats and rules; why every claim here is dated |
| облік товарних запасів | goods stock records | A record-keeping obligation, scope per T1 |
